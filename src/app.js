
class LangflowClient {
    constructor(baseURL, applicationToken) {
        this.baseURL = baseURL;
        this.applicationToken = applicationToken;
    }
    async post(endpoint, body, headers = {"Content-Type": "application/json"}) {
        // headers["Authorization"] = `Bearer ${this.applicationToken}`;
        headers["Content-Type"] = "application/json";
        const url = `${this.baseURL}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            const responseMessage = await response.json();
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText} - ${JSON.stringify(responseMessage)}`);
            }
            return responseMessage;
        } catch (error) {
            console.error('Request Error:', error.message);
            throw error;
        }
    }

    async initiateSession(flowId, langflowId, inputValue, inputType = 'chat', outputType = 'chat', stream = false, tweaks = {}) {
        const endpoint = `/lf/${langflowId}/api/v1/run/${flowId}?stream=${stream}`;
        return this.post(endpoint, { input_value: inputValue, input_type: inputType, output_type: outputType, tweaks: tweaks });
    }

    handleStream(streamUrl, onUpdate, onClose, onError) {
        const eventSource = new EventSource(streamUrl);

        eventSource.onmessage = event => {
            const data = JSON.parse(event.data);
            onUpdate(data);
        };

        eventSource.onerror = event => {
            console.error('Stream Error:', event);
            onError(event);
            eventSource.close();
        };

        eventSource.addEventListener("close", () => {
            onClose('Stream closed');
            eventSource.close();
        });

        return eventSource;
    }

    async runFlow(flowIdOrName, langflowId, inputValue, inputType = 'chat', outputType = 'chat', tweaks = {}, stream = false, onUpdate, onClose, onError) {
        try {
            const initResponse = await this.initiateSession(flowIdOrName, langflowId, inputValue, inputType, outputType, stream, tweaks);
            console.log('Init Response:', initResponse);
            if (stream && initResponse && initResponse.outputs && initResponse.outputs[0].outputs[0].artifacts.stream_url) {
                const streamUrl = initResponse.outputs[0].outputs[0].artifacts.stream_url;
                console.log(`Streaming from: ${streamUrl}`);
                this.handleStream(streamUrl, onUpdate, onClose, onError);
            }
            return initResponse;
        } catch (error) {
            console.error('Error running flow:', error);
            onError('Error initiating session');
        }
    }
}


async function sendMessage(message) {
    // const applicationToken = process.env.APP_TOKEN;
    const langflowClient = new LangflowClient('/proxyapi'); // Use proxy path
    const flowIdOrName = '3e110a04-a4a6-4563-8583-677ec4a867c2';
    const langflowId = 'e64e60dd-de16-4f82-b0b0-a2614900fb39';

    try {
        const tweaks = {
            "ChatInput-x4Fjo": {},
            "Prompt-V9Pbp": {},
            "OpenAIModel-Erifd": {},
            "ChatOutput-LU6cI": {}
        };
        const response = await langflowClient.runFlow(
            flowIdOrName,
            langflowId,
            message,
            'chat',
            'chat',
            tweaks,
            false,
            (data) => console.log("Received:", data.chunk), // onUpdate
            (message) => console.log("Stream Closed:", message), // onClose
            (error) => console.log("Stream Error:", error) // onError
        );

        if (response && response.outputs) {
            const flowOutputs = response.outputs[0];
            const firstComponentOutputs = flowOutputs.outputs[0];
            const output = firstComponentOutputs.outputs.message;

            return output.message.text;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        return 'Error: ' + error.message;
    }
}