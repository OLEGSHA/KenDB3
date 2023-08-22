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
     * Pending dumps.
     */
    private dumpsPending = new Set<string>();

    /**
     * Event bus for status update events.
     */
    private eventBus = new EventTarget();

    /**
     * Full download URL without the `ids` search parameter.
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
     * @param requestUrl download URL without the `ids` search parameter
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
            return (this.dumpsPending.has(fields)
                ? Status.Pending
                : Status.NotRequested);
        } else {
            return instance.statusOf(fields);
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
     * Return all instances with given IDs. Specified field group will be
     * available.
     *
     * If all requested data is available, method does not block.
     *
     * @param ids the IDs of instances to return
     * @param fields the field group that must be available
     */
    async get_all(
        ids: Iterable<number>,
        fields: string = '*'
    ): Promise<Model[]> {
        // Contains instances that were at some point Available
        const map = new Map<number, Model>();
        // Contains all IDs that are not in map
        const missingIds = new Set<number>(ids);

        debug(`Dataman: get_all ${this.modelClass.name} [${Array.from(missingIds).join(', ')}]`);

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
            await new Promise((resolve) => {
                this.eventBus.addEventListener(
                    'update',
                    () => resolve(undefined),
                    { once: true }
                );
            });
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
     */
    async get(id: number, fields: string = '*'): Promise<Model> {
        return (await this.get_all([id], fields))[0];
    }

    /**
     * Helper method for get_all(). Returns an Error with detailed description.
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

        debug(`Dataman: download ${this.modelClass.name} [${Array.from(idsToDownload).join(', ')}]`);

        const url = new URL(this.requestUrl);
        url.searchParams.append('ids', Array.from(idsToDownload).join(','));
        fetch(url)
            .then((response) => this.handleResponse(
                response,
                fields,
                idsToDownload,
            ))
            .catch((error) => this.handleError(error));
    }

    /**
     * Handle a raw fetch() response.
     *
     * @param response the Response object
     * @param fields the fields to set
     * @param pendingIds the IDs that should be made Available or NotRequested
     */
    private async handleResponse(
        response: Response,
        fields: string,
        pendingIds: Iterable<number>,
    ): Promise<void> {
        // TODO error handling
        const data = await response.json();
        const pendingIdsCopy = new Set<number>(pendingIds);

        debug(`Dataman: handleResponse ${this.modelClass.name} [${Array.from(pendingIdsCopy).join(', ')}]`);

        // Fill in data and update status of received instances
        for (const instanceData of data as {id: number}[]) {
            const id = instanceData.id;

            // Sanity check
            if (!pendingIdsCopy.has(id)) {
                throw new Error('Received instance that was not requested');
            }

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
            pendingIdsCopy.delete(id);
        }

        // Remove pending status for remaining instances
        for (const id of pendingIdsCopy) {
            this.getOrCreate(id).setStatus(fields, Status.NotRequested);
        }

        // Raise event
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

enum Status {
    NotRequested,
    Pending,
    Available,
}

class ModelBase {
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
        debug(`Dataman: ${this.constructor.name} ID ${this.id}: '${fields}' is now ${status}`);
    }
}

/*
 * Model class mockups - to be autogenerated
 */

export class Submission extends ModelBase {
    static objects: ModelManager<Submission>;

    latest_revision: any | null;
    revisions: any | null;

    private '_fields_*': Status = Status.NotRequested;
}
manageModel(Submission,
            new URL('api/v0/submission', window.location.origin));

export class SubmissionRevision extends ModelBase {
    static objects: ModelManager<SubmissionRevision>;

    name: any | null;
    submitted_at: any | null;

    private '_fields_*': Status = Status.NotRequested;
    private '_fields_basic': Status = Status.NotRequested;
}
manageModel(SubmissionRevision,
            new URL('api/v0/submission_revision', window.location.origin));
