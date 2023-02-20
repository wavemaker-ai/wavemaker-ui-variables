import { oauthService, appManager } from './variable/variables.utils';

export const performAuthorization = (url: any, providerId: any, onSuccess: any, onError: any, securityObj?: any) => {
    oauthService.perfromOAuthorization(url, providerId, onSuccess, onError, securityObj, appManager.getCustomUrlScheme(), appManager.getDeployedURL());
};

export const getAccessToken = (provider: any, checkLoaclStorage: any) => {
    return oauthService.getAccessToken(provider, checkLoaclStorage);
};

export const removeAccessToken = (provider: any) => {
    oauthService.removeAccessToken(provider);
}
