export class NotifyPromise {

    constructor(fn: any) {
        const notifyQueue: any = [],
            notify = (status: any) => {
            notifyQueue.forEach((fn1: any) => {
                fn1(status);
            });
        };

        const cleanUp = function() {
            notifyQueue.length = 0;
        };

        const p1 =  new Promise((res, rej) => {
            fn(res, rej, notify);
        });

        (p1 as any).superThen = p1.then.bind(p1);
        (p1 as any).then = (onResolve: any, onReject: any, onNotify: any) => {
            (p1 as any).superThen(
                (response: any) => {
                    onResolve(response);
                    cleanUp();
                },
                (reason: any) => {
                    onReject(reason);
                    cleanUp();
                }
            );
            if (onNotify) {
                notifyQueue.push(onNotify);
            }
        };
        return p1;
    }
}

// let newPromise = new PromiseWithNotify((resolve, reject, notify) => {
//     setInterval(notify, 1000);
// })
// console.log(newPromise)
// newPromise.then(undefined, undefined, () => console.log(3));
