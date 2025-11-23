import io from '@pm2/io';

const metrics = {
    httpRequestDuration: io.metric({
        name: 'http_request_duration',
        unit: 'ms'
    }),
    activeRequests: io.counter({
        name: 'active_requests'
    }),
    errors: io.counter({
        name: 'errors'
    })
};

export const trackRequestDuration = (start) => {
    const duration = Date.now() - start;
    metrics.httpRequestDuration.set(duration);
};

export const incrementActiveRequests = () => {
    metrics.activeRequests.inc();
};

export const decrementActiveRequests = () => {
    metrics.activeRequests.dec();
};

export const incrementErrors = () => {
    metrics.errors.inc();
};

export default metrics;
