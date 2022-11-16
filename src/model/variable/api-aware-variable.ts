import { BaseVariable } from '../base-variable';

export abstract class ApiAwareVariable extends BaseVariable {

    service: string;
    operation: string;
    controller: string;
    operationId: string;
    operationType: string;
    serviceType: string;
    maxResults: number;
    startUpdate: boolean;
    autoUpdate: boolean;
    inFlightBehavior: boolean;
    transformationRequired: boolean;
    canUpdate: boolean;
    paginationTransformationRequired: boolean;

    firstRecord: any;
    lastRecord: any;

    onBeforeUpdate: string;
    onResult: string;
    onError: string;
    onBeforeDatasetReady: string;
    onSuccess: string;
}
