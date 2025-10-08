import { StorageService } from "./storage";

export abstract class InterceptContext<V> {

    constructor(public variable: V, public readonly stores: {
        temp: StorageService,
        session: StorageService,
        persistent: StorageService
    }) {}

    abstract proceed(): Promise<any>;
}
