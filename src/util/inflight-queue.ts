class InflightQueue {
    requestsQueue = new Map();

    /**
     * pushes the process against a variable in its queue
     * @param variable
     * @param {{resolve: (value?: any) => void; reject: (reason?: any) => void}} param2
     * the resolve callback will be called on
     */
    private addToQueue(variable: any, param2: {resolve: (value?: (any)) => void; reject: (reason?: any) => void}) {
        if (this.requestsQueue.has(variable)) {
            this.requestsQueue.get(variable).push(param2);
        } else {
            const processes = [];
            processes.push({resolve: param2.resolve, reject: param2.reject, active: false});
            this.requestsQueue.set(variable, processes);
        }
    }

    /**
     * Calls the reject method against the passed process
     * @param process
     */
    private rejectProcess(process: any) {
        process.reject('PROCESS_REJECTED_IN_QUEUE');
    }

    /**
     * clears the queue against a variable
     * @param variable
     */
    public clear(variable: any) {
        this.requestsQueue.delete(variable);
    }

    /**
     * executes the n/w calls for a specified variable pushed in its respective queue (pushed while it was inFlight)
     * @param variable
     */
    process(variable: any) {
        const processes: [any] = this.requestsQueue.get(variable);
        let nextProcess;

        // process request queue for the variable only if it is not empty
        if (!processes || !processes.length) {
            this.clear(variable);
            return;
        }

        // If only one item in queue
        if (processes.length === 1) {
            nextProcess = processes[0];
            if (nextProcess.active) {
                this.clear(variable);
            } else {
                nextProcess.active = true;
                nextProcess.resolve();
            }
            return;
        }

        switch (variable.inFlightBehavior) {
            case 'executeLast':
                for (let i = 0; i < processes.length - 2; i++) {
                    this.rejectProcess(processes[i]);
                }
                processes.splice(0, processes.length - 1);
                this.process(variable);
                break;
            case 'executeAll':
                nextProcess = processes.splice(0, 1)[0];
                if (nextProcess.active) {
                    nextProcess = processes.splice(0, 1)[0];
                }
                nextProcess.active = true;
                nextProcess.resolve();
                break;
            default:
                for (let i = 0; i < processes.length - 1; i++) {
                    this.rejectProcess(processes[i]);
                }
                this.clear(variable);
                break;
        }
    }

    /**
     * initializes the queue against a variable and makes the first process call
     * If already initialized and a process in queue is in progress, the queue is not processed.
     * To process the next item in the queue, the process method has to be called from the caller.
     * @param variable
     * @returns {Promise<any>}
     */
    submit(variable: any) {
        return new Promise((resolve, reject) => {
            this.addToQueue(variable, {resolve: resolve, reject: reject});

            if (this.requestsQueue.get(variable).length === 1) {
                this.process(variable);
            }
        });
    }
}

export const $queue = new InflightQueue();
