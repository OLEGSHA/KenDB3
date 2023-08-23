import { debug } from 'common'

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
    private modelClass: new(id: number) => Model;

    /**
     * Create a ModelManager.
     *
     * @param modelClass model class
     * @param requestUrl download URL without `ids` or `fields`.
     */
    constructor(
        modelClass: new(id: number) => Model,
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
        const seenIds = this.doAddData(data.payload as Packet, fields);

        if (pendingIds !== null) {
            // Selective request

            // Remove pending status for remaining instances
            const pendingIdsCopy = new Set<number>(pendingIds);
            for (const id of seenIds) {
                if (pendingIdsCopy.has(id)) {
                    pendingIdsCopy.delete(id);
                }
            }
            for (const id of pendingIdsCopy) {
                this.getOrCreate(id).setStatus(fields, Status.NotRequested);
            }

        } else {
            // Dump request
            this.setStatusOfDump(fields, Status.Available);
        }

        // Raise event
        this.eventBus.dispatchEvent(new Event('update'));
    }

    /**
     * Add data as if from a download request.
     *
     * This method does not fire any events; ensure that events are fired.
     *
     * @param data an instance array
     * @param fields the fields provided
     *
     * @returns the set of all IDs encountered
     */
    private doAddData(data: Packet, fields: string): Set<number> {
        const seenIds = new Set<number>();

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
            seenIds.add(id);
        }

        debug(`Dataman: doAddData ${this.modelClass.name} `
              + `fields ${fields} IDs`, Array.from(seenIds));

        return seenIds;
    }

    /**
     * Add data as if from a download request.
     *
     * @param data an instance array
     * @param fields the fields provided
     */
    addData(data: Packet, fields: string): void {
        const added = this.doAddData(data, fields);
        this.eventBus.dispatchEvent(new Event('update'));
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
 * Create a ModelManager and store it in modelClass.objects.
 *
 * @param modelClass model class
 * @param requestUrl download URL without the `ids` search parameter
 */
export function manageModel<Model extends ModelBase>(
    modelClass: new(id: number) => Model,
    requestUrl: URL | string,
): void {
    (modelClass as any).objects
        = new ModelManager<Model>(modelClass, requestUrl);
}

export type Packet = {
    instances: {
        id: number
    }[],
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
        debug(`Dataman: created ${this.constructor.name} ID ${id}`);
    }

    statusOf(fields: string): Status {
        return (this as any)['_fields_' + fields];
    }

    setStatus(fields: string, status: Status) {
        (this as any)['_fields_' + fields] = status;
        debug(`Dataman: ${this.constructor.name} ID ${this.id}: '${fields}' is now ${Status[status]}`);
    }
}
