export default class EventNotifier {
    private listeners = {} as any;

    public notify(event: string, args: any[]) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((l: Function) => {
                l && l.apply(null, args);
            });
        }
    }

    public subscribe(event: string, fn: Function) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(fn);
        return () => {
            const eventListeners = this.listeners[event];
            const i = eventListeners.findIndex((fni: Function) => fni === fn);
            eventListeners.splice(i, 1);
        };
    }
}