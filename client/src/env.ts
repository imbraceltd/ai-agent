declare global {
    interface Window {
        readonly env: NodeJS.Process['env'];
    }
}

export const env = { ...import.meta.env, ...window.env };

(async () => {
    try {
        const apiEndpoint = '/api/config';
        console.log('env.ts: Fetching from:', apiEndpoint);

        const response = await fetch(apiEndpoint);
        console.log(response,'response')
        if (!response.ok) {
            throw new Error(`Failed to load environment: ${response.status}`);
        }
        const apiResponse = await response.json();
        
        // Extract data from API response format
        const apiEnv = apiResponse.success ? apiResponse.data : apiResponse;

        Object.assign(env, apiEnv);
        console.log('env.ts: Updated env', env); // Log final env

        Object.defineProperty(window, 'env', {
            value: env,
            writable: false,
        });
    } catch (error) {
        console.error('Error loading environment from API:', error);
    }
})();