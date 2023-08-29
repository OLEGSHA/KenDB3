import { debug, error } from 'common'

/**
 * Manages model instances of one type.
 *
 * Instances have different data fields, which are grouped into one or more
 * named 'field groups' (each usually referred to as 'fields' in code). These
 * groups overlap in practice, but are treated as unrelated by this manager.
 *
 * Each request for an instance has to specify which fields are needed.
 * The manager then consults the instance store to determine if this data is
 * available immeditely, and if not, arranges its retrieval. All field groups
 * are tracked separately even though they share attributes.
 *
 * Transitions of field groups:
 *   - NotRequested -> Pending: request is made to backend
 *   - Pending -> Available: request completes and fields are found
 *   - Pending -> NotRequested: request completes and fields are missing
 */
export class ModelManager<Model extends ModelBase> {

    /**
     * All instances of this model by ID.
     */
    private store = new Map<number, Model>();

    /**
     * Status of dumps (requests for all objects from DB).
     * Dumps not present in this map are assumed to be NotRequested.
     */
    private dumps = new Map<string, Status>();

    /**
     * Event bus for status update events.
     */
    private eventBus = new EventTarget();

    /**
     * Full download URL without the `ids` and `fields` search parameters.
     */
    private requestUrl: URL;

    /**
     * Model constructor.
     */
    private modelClass: ModelClass<Model>;

    /**
     * Create a ModelManager.
     *
     * @param modelClass model class
     * @param requestUrl download URL without `ids` or `fields`.
     */
    constructor(
        modelClass: ModelClass<Model>,
        requestUrl: URL | string
    ) {
        this.requestUrl = new URL(requestUrl);
        this.modelClass = modelClass;
    }

    /**
     * Return status of given fields of the instance identified by id.
     *
     * @param id ID of the instance to check
     * @param fields the field group to check
     *
     * @returns the status
     */
    private statusOf(id: number, fields: string): Status {
        const instance = this.store.get(id);
        if (instance === undefined) {
            return (this.dumps.get(fields) === Status.Pending
                ? Status.Pending
                : Status.NotRequested);
        } else {
            return instance.statusOf(fields);
        }
    }

    /**
     * Return status of specified field dump.
     *
     * @param fields the field group to check
     *
     * @returns the status
     */
    private statusOfDump(fields: string): Status {
        return this.dumps.get(fields) ?? Status.NotRequested;
    }

    /**
     * Sets the status of provided field dump.
     *
     * Status of exsting instances is upgraded accordingly.
     *
     * @param fields the field group of the dump
     * @param status the new status
     */
    private setStatusOfDump(fields: string, status: Status): void {
        this.dumps.set(fields, status);

        for (const instance of this.store.values()) {
            if (instance.statusOf(fields) < status) {
                instance.setStatus(fields, status);
            }
        }
    }

    /**
     * Get or create an instance with given ID.
     *
     * @param id the instance ID to obtain
     *
     * @returns the instance
     */
    private getOrCreate(id: number): Model {
        let instance = this.store.get(id);
        if (instance === undefined) {
            instance = new this.modelClass(id);
            this.store.set(id, instance);
        }
        return instance;
    }

    /**
     * Return instances with given IDs. Specified field group will be
     * available.
     *
     * If all requested data is available, method does not block.
     *
     * @param ids the IDs of instances to return
     * @param fields the field group that must be available
     *
     * @returns requested models; order is not defined
     */
    async getBulk(
        ids: Iterable<number>,
        fields: string = '*'
    ): Promise<Model[]> {
        // Contains instances that were at some point Available
        const map = new Map<number, Model>();
        // Contains all IDs that are not in map
        const missingIds = new Set<number>(ids);

        debug(`Dataman: getBulk ${this.modelClass.name} fields ${fields} IDs`,
              Array.from(missingIds));

        // Request download of any non-Available fields
        this.download(missingIds, fields);

        while (true) {
            // Check missing IDs
            for (const id of missingIds) {
                switch (this.statusOf(id, fields)) {

                    case Status.Available:
                        // Move from missing to map
                        map.set(id, this.store.get(id) as Model);
                        missingIds.delete(id);
                        break;

                    case Status.Pending:
                        // Do nothing
                        break;

                    case Status.NotRequested:
                        // Download has failed - escalate
                        throw this.downloadFailError(missingIds, fields);

                }
            }

            // Is waiting necessary?
            if (missingIds.size === 0) {
                break;
            }

            // Wait for more data
            await this.blockUntilUpdate();
        }

        return Array.from(map.values());
    }

    /**
     * Return the instances with given ID. Specified field group will be
     * available.
     *
     * If requested data is available, method does not block.
     *
     * @param id the ID of instances to return
     * @param fields the field group that must be available
     *
     * @returns requested model
     */
    async get(id: number, fields: string = '*'): Promise<Model> {
        return (await this.getBulk([id], fields))[0];
    }

    /**
     * Return all instances of this model. Specified field group will be
     * available.
     *
     * If all requested data is available, method does not block.
     *
     * @param fields the field group that must be available
     *
     * @returns all models; order is not defined
     */
    async getAll(fields: string = '*'): Promise<Model[]> {
        debug(`Dataman: getAll ${this.modelClass.name} fields ${fields}`);

        // Request download
        if (this.statusOfDump(fields) === Status.NotRequested) {
            this.downloadAll(fields);
        }

        while (true) {
            switch (this.statusOfDump(fields)) {

                case Status.Available:
                    return Array.from(this.store.values());

                case Status.Pending:
                    break;

                case Status.NotRequested:
                    throw new Error(
                        `Could not download ${this.modelClass.name} dump`);

            }

            await this.blockUntilUpdate();
        }
    }

    /**
     * Blocks until an update occurs.
     */
    private async blockUntilUpdate(): Promise<void> {
        await new Promise((resolve) => {
            this.eventBus.addEventListener(
                'update',
                () => resolve(undefined),
                { once: true }
            );
        });
    }

    /**
     * Helper method for getBulk(). Returns an Error with detailed description.
     *
     * @param ids IDs that must not be NotRequested
     * @param fields the field group to check
     *
     * @returns the constructed Error
     */
    private downloadFailError(ids: Iterable<number>, fields: string): Error {
        const badIds = Array.from(ids).filter(
            (id) => this.statusOf(id, fields) === Status.NotRequested
        );
        return new Error(
            `Could not download ${this.modelClass.name} `
            + `instances with IDs [${badIds.join(', ')}]`
        );
    }

    /**
     * Download all missing data for requested fields of given instance IDs.
     *
     * This method does not block under any circumstances. Request includes
     * only data that is not already available.
     *
     * @param ids the instance IDs to download if necessary
     * @param fields the field group to download
     */
    download(ids: Iterable<number>, fields: string = '*'): void {
        const idsToDownload = new Set<number>();

        for (const id of ids) {
            if (this.statusOf(id, fields) === Status.NotRequested) {
                idsToDownload.add(id);
                this.getOrCreate(id).setStatus(fields, Status.Pending);
            }
        }
        if (idsToDownload.size === 0) {
            return;
        }

        debug(`Dataman: download ${this.modelClass.name} `
              + `fields ${fields} IDs`, Array.from(idsToDownload));

        const url = new URL(this.requestUrl);
        url.searchParams.append('ids', Array.from(idsToDownload).join(','));
        url.searchParams.append('fields', fields);
        fetch(url)
            .then((response) => this.handleResponse(
                response,
                fields,
                idsToDownload,
            ))
            .catch((error) => this.handleError(error));
    }

    /**
     * Download all missing data for requested fields of all instances.
     *
     * This method does not block under any circumstances. Due to an API limit-
     * ation, all data is requested, regardless of current availability inclu-
     * des only data that is not already available.
     *
     * @param fields the field group to download
     */
    downloadAll(fields: string): void {
        this.setStatusOfDump(fields, Status.Pending);

        debug(`Dataman: download ${this.modelClass.name} `
              + `fields ${fields} dump`);

        const url = new URL(this.requestUrl);
        url.searchParams.append('ids', 'all');
        url.searchParams.append('fields', fields);
        fetch(url)
            .then((response) => this.handleResponse(
                response,
                fields,
                null,
            ))
            .catch((error) => this.handleError(error));
    }

    /**
     * Handle a raw fetch() response.
     *
     * @param response the Response object
     * @param fields the fields to set
     * @param pendingIds the IDs that should be made Available or NotRequested,
     *        or null if handling dump request
     */
    private async handleResponse(
        response: Response,
        fields: string,
        pendingIds: Iterable<number> | null,
    ): Promise<void> {
        // TODO error handling
        if (!response.ok) {
            response.json()
                .catch((e) => {
                    console.error(e);
                    throw new Error(`Got status code ${response.status} `
                                    + 'from API, response is not JSON');
                })
                .then((json) => {
                    let msg: string = `Got status code ${response.status} `
                                      + `from API, `;
                    if ('status' in json) {
                        msg += 'message: ' + json.status;
                    } else {
                        msg += "response is JSON but 'status' not found";
                    }

                    throw new Error(msg);
                });
            return;
        }

        const data = await response.json();

        // Fill in data and update status of received instances
        const seen = this.doAddData(data.payload as Packet, fields);

        if (pendingIds !== null) {
            // Remove pending status for remaining instances
            const pendingIdsCopy = new Set<number>(pendingIds);
            for (const instance of seen) {
                const id = instance.id;
                if (pendingIdsCopy.has(id)) {
                    pendingIdsCopy.delete(id);
                }
            }
            for (const id of pendingIdsCopy) {
                this.getOrCreate(id).setStatus(fields, Status.NotRequested);
            }
        }

        // Raise event
        this.fireUpdateEvent(seen, fields);
    }

    /**
     * Add data as if from a download request.
     *
     * This method does not fire any events; ensure that events are fired.
     *
     * @param data an instance array
     * @param fields the fields provided
     *
     * @returns the set of all instances encountered
     */
    private doAddData(data: Packet, fields: string): Set<Model> {
        const seenInstances = new Set<Model>();

        // Ensure data consistency
        const dataTimestamp = new Date(data.last_modified);
        if (_lastModified === null) {
            _lastModified = dataTimestamp;
        } else if (_lastModified.getTime() != dataTimestamp.getTime()) {
            this.handleObsoletion();
        }

        for (const instanceData of data.instances) {
            const id = instanceData.id;

            // Fill in data
            const instance = this.getOrCreate(id);
            for (const key in instanceData) {
                if (key === 'id') {
                    continue;
                }
                (instance as any)[key] = (instanceData as any)[key];
            }

            // Update status and mark as completed
            instance.setStatus(fields, Status.Available);
            seenInstances.add(instance);
        }

        if (data.dump) {
            this.setStatusOfDump(fields, Status.Available);
        }

        debug(`Dataman: doAddData ${this.modelClass.name} `
              + `fields ${fields} IDs`,
              Array.from(seenInstances).map((i) => i.id));

        return seenInstances;
    }

    /**
     * Fire an update event.
     *
     * @param updatedInstances instances to report as updated
     * @param fields the field group that was updated
     */
    private fireUpdateEvent(
        updatedInstances: Iterable<Model>,
        fields: string
    ): void {
        const detail = {
            'updated': Array.from(updatedInstances),
            'fields': fields,
        }
        const event = new CustomEvent('update', {'detail': detail})
        this.eventBus.dispatchEvent(event);
    }

    /**
     * Call action once for every instance that has at least one Available
     * field group.
     *
     * action is applied retroactively to all existing instances when the call
     * is made.
     *
     * @param action the action to run
     */
    doOnceForEach(action: (inst: Model) => void): void {
        const visited = new Set<number>();

        /**
         * Checks if instance has available fields and is new then calls action
         */
        const wrappedAction = (instance: Model) => {
            if (!this.modelClass.fields.some(
                (f) => instance.statusOf(f) === Status.Available
            )) {
                return;
            }

            if (visited.has(instance.id)) {
                return;
            }

            visited.add(instance.id);
            action(instance);
        }

        this.store.forEach(wrappedAction);

        this.addEventListener('update', (e) => {
            const updated = (e as CustomEvent<{
                updated: Model[],
                fields: string,
            }>).detail.updated;
            updated.forEach(wrappedAction);
        });
    }

    /**
     * Add an event listener. See EventTarget.addEventListener.
     *
     * Available events:
     *   - update: CustomEvent<{updated: Model[], fields: string}>
     *     Fired when any instances change. updated includes all inst-
     *     ances that have changed.
     */
    addEventListener = (
        this.eventBus.addEventListener.bind(this.eventBus));

    /**
     * Add an event listener. See EventTarget.removeEventListener.
     */
    removeEventListener = (
        this.eventBus.removeEventListener.bind(this.eventBus));

    /**
     * Called when server data last-modified timestamp changes.
     */
    private handleObsoletion(): void {
        // Panic!
        window.location.reload();
    }

    /**
     * Add data as if from a download request.
     *
     * @param data an instance array
     * @param fields the fields provided
     */
    addData(data: Packet, fields: string): void {
        const seen = this.doAddData(data, fields);
        this.fireUpdateEvent(seen, fields);
    }

    /**
     * Handle a rejected fetch().
     *
     * @param error the error object
     */
    private handleError(error: any): void {
        // TODO handle more gracefully
        throw new Error(error);
    }

}

/**
 * Timestamp of last modification of data on server, or null if no packets
 * have been processed yet.
 */
var _lastModified: Date | null = null;

/**
 * Timestamp of last modification of data on server.
 *
 * @returns the timestamp
 * @throws {Error} if no packets have been processed yet
 */
export function lastModified(): Date {
    return _lastModified ?? error('No data available');
}

/**
 * Create a ModelManager and store it in modelClass.objects.
 *
 * @param modelClass model class
 * @param requestUrl download URL without the `ids` search parameter
 */
export function manageModel<Model extends ModelBase>(
    modelClass: ModelClass<Model>,
    requestUrl: URL | string,
): void {
    modelClass.objects = new ModelManager<Model>(modelClass, requestUrl);
}

export type Packet = {
    instances: {
        id: number
    }[],
    last_modified: string,
    dump: boolean,
};

export enum Status {
    NotRequested,
    Pending,
    Available,
}

export class ModelBase {
    id: number;

    constructor(id: number) {
        this.id = id;
    }

    statusOf(fields: string): Status {
        return (this as any)['_fields_' + fields];
    }

    setStatus(fields: string, status: Status): void {
        (this as any)['_fields_' + fields] = status;
    }

    /**
     * Get instances referenced by ID in a field and make them available via
     * a property.
     *
     * Source fields are coupled with instance container fields, determined by
     * source field names, e.g. 'authors_ids' (source) -> 'authors' (container).
     * This function populates
     *
     * @param source the field in parents that contains the IDs.
     *        Must be *_id or *_ids.
     * @param fields the child fields to get.
     */
    resolve(
        source: string,
        fields: string = '*'
    ): Promise<void> {
        return resolve([this], source, fields);
    }
}

/**
 * Get instances referenced by ID in a field and make them available via
 * a property.
 *
 * Source fields are coupled with instance container fields, determined by
 * source field names, e.g. 'authors_ids' (source) -> 'authors' (container).
 * This function populates
 *
 * @param parents the instances where IDs can be found
 * @param source the field in parents that contains the IDs.
 *        Must be *_id or *_ids.
 * @param fields the child fields to get.
 */
export async function resolve<
    ParentModel extends ModelBase
>(
    parents: Iterable<ParentModel>,
    source: string,
    fields: string = '*',
): Promise<void> {
    let parentArray = Array.from(parents);

    if (parentArray.length === 0) {
        return;
    }

    const childIds = new Set<number>();
    const childMap = new Map<number, ModelBase>();

    const [
        target, // Name of container field
        idExtractor,
        assigner,
    ] = (() => {
        if (source.endsWith('_id')) {
            const target = source.substring(0, source.length - '_id'.length);
            return [
                target,
                (p: any) => childIds.add(p[source]),
                (p: any) => p[target] = childMap.get(p[source]),
            ]
        } else if (source.endsWith('_ids')) {
            const target = source.substring(0, source.length - '_ids'.length);
            return [
                target,
                (p: any) => p[source].forEach((i: number) => childIds.add(i)),
                (p: any) => {
                    const result = [];
                    for (const id of p[source]) {
                        result.push(childMap.get(id));
                    }
                    p[target] = result;
                },
            ]
        } else {
            throw new Error(`No strategy to resolve field '${source}'`);
        }
    })();

    const interested = (p: any) => p[target] === null;

    // Collect child IDs
    parentArray = parentArray.filter(interested);
    parentArray.forEach(idExtractor);

    // Get children
    const parentClass = Object.getPrototypeOf(parentArray[0]).constructor;
    const childClass = parentClass['_type_of_' + target];
    const children = await childClass.objects.getBulk(childIds, fields);
    for (const child of children) {
        childMap.set(child.id, child);
    }

    // Assign children
    parentArray = parentArray.filter(interested);
    parentArray.forEach(assigner);
}

export interface ModelClass<Model extends ModelBase> {
    new (id: number): Model;
    objects: ModelManager<Model>;
    fields: string[];
}
