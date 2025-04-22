# pac3

Personalized Automation with Custom Copilot Client

## Overview
`pac3` is a custom automation tool designed to interact with GitHub's Copilot API and streamline workflows. It includes features like device code authentication, token management, and generating user stories based on prompts.

## Features
- Device code flow for authentication.
- Proxy support for network requests.
- Automatic token refresh.
- Generate user stories in JSON format.

## Example Code Snippets

### Device Code Authentication
```javascript
async function getUserAndDeviceCode() {
    try {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        const body = JSON.stringify({
            "client_id": envConfig.clientId,
            "scope": "read:user"
        });

        const fetchOptions = {
            method: 'POST',
            headers,
            body,
            redirect: 'follow'
        };

        if (envConfig.proxyUrl) {
            fetchOptions.agent = new HttpsProxyAgent(envConfig.proxyUrl);
        }

        const response = await fetch("https://github.com/login/device/code", fetchOptions);

        if (!response.ok) {
            throw new Error(`Failed to fetch device code: ${response.statusText}`);
        }

        const respJson = await response.json();
        console.log(`Please open ${respJson.verification_uri} and enter the code ${respJson.user_code}`);
    } catch (error) {
        console.error("Error in getUserAndDeviceCode:", error);
    }
}
```

### Chat Completion
```javascript
async function chatCompletion(prompt) {
    try {
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${envConfig.bearerToken}`
        };

        const body = JSON.stringify({
            "max_tokens": 1024,
            "n": 1,
            "temperature": 0,
            "top_p": 1,
            "stop": ["---"],
            "prompt": prompt,
            "stream": true
        });

        const fetchOptions = {
            method: 'POST',
            headers,
            body,
            redirect: 'follow'
        };

        if (envConfig.proxyUrl) {
            fetchOptions.agent = new HttpsProxyAgent(envConfig.proxyUrl);
        }

        const response = await fetch("https://copilot-proxy.githubusercontent.com/v1/engines/copilot-codex/completions", fetchOptions);

        if (!response.ok) {
            throw new Error(`Failed to fetch chat completion: ${response.statusText}`);
        }

        const respText = await response.text();
        return respText.split("\n")
            .filter(x => x.startsWith("data") && x !== "data: [DONE]")
            .map(x => x.replace(/^data:/, ''))
            .map(x => JSON.parse(x).choices[0]?.text)
            .join("");
    } catch (error) {
        console.error("Error in chatCompletion:", error);
        return null;
    }
}
```

## Example Code Snippets Explained

### Device Code Authentication
```javascript
async function getUserAndDeviceCode() {
    try {
        const headers = {
            "Content-Type": "application/json", // Specifies the content type of the request as JSON.
            "Accept": "application/json" // Indicates that the response should be in JSON format.
        };
        const body = JSON.stringify({
            "client_id": envConfig.clientId, // Includes the client ID from the environment configuration.
            "scope": "read:user" // Requests the "read:user" scope for permissions.
        });

        const fetchOptions = {
            method: 'POST', // Specifies the HTTP method as POST.
            headers, // Attaches the headers defined above.
            body, // Attaches the request body defined above.
            redirect: 'follow' // Follows any HTTP redirects automatically.
        };

        if (envConfig.proxyUrl) {
            fetchOptions.agent = new HttpsProxyAgent(envConfig.proxyUrl); // Adds a proxy agent if a proxy URL is configured.
        }

        const response = await fetch("https://github.com/login/device/code", fetchOptions); // Sends the POST request to GitHub's device code endpoint.

        if (!response.ok) {
            throw new Error(`Failed to fetch device code: ${response.statusText}`); // Throws an error if the response status is not OK.
        }

        const respJson = await response.json(); // Parses the response as JSON.
        console.log(`Please open ${respJson.verification_uri} and enter the code ${respJson.user_code}`); // Logs the verification URI and user code for the user to complete authentication.
    } catch (error) {
        console.error("Error in getUserAndDeviceCode:", error); // Logs any errors that occur during the process.
    }
}
```

### Chat Completion
```javascript
async function chatCompletion(prompt) {
    try {
        const headers = {
            "Content-Type": "application/json", // Specifies the content type of the request as JSON.
            "Authorization": `Bearer ${envConfig.bearerToken}` // Attaches the bearer token for authentication.
        };

        const body = JSON.stringify({
            "max_tokens": 1024, // Limits the maximum number of tokens in the response.
            "n": 1, // Requests a single response.
            "temperature": 0, // Sets the randomness of the response to deterministic.
            "top_p": 1, // Uses the full probability distribution for token selection.
            "stop": ["---"], // Specifies a stopping sequence for the response.
            "prompt": prompt, // Includes the user-provided prompt in the request.
            "stream": true // Enables streaming of the response.
        });

        const fetchOptions = {
            method: 'POST', // Specifies the HTTP method as POST.
            headers, // Attaches the headers defined above.
            body, // Attaches the request body defined above.
            redirect: 'follow' // Follows any HTTP redirects automatically.
        };

        if (envConfig.proxyUrl) {
            fetchOptions.agent = new HttpsProxyAgent(envConfig.proxyUrl); // Adds a proxy agent if a proxy URL is configured.
        }

        const response = await fetch("https://copilot-proxy.githubusercontent.com/v1/engines/copilot-codex/completions", fetchOptions); // Sends the POST request to the Copilot API endpoint.

        if (!response.ok) {
            throw new Error(`Failed to fetch chat completion: ${response.statusText}`); // Throws an error if the response status is not OK.
        }

        const respText = await response.text(); // Reads the response as plain text.
        return respText.split("\n") // Splits the response into lines.
            .filter(x => x.startsWith("data") && x !== "data: [DONE]") // Filters out lines that do not start with "data" or are marked as "DONE".
            .map(x => x.replace(/^data:/, '')) // Removes the "data:" prefix from each line.
            .map(x => JSON.parse(x).choices[0]?.text) // Parses each line as JSON and extracts the text from the first choice.
            .join(""); // Joins the extracted text into a single string.
    } catch (error) {
        console.error("Error in chatCompletion:", error); // Logs any errors that occur during the process.
        return null; // Returns null in case of an error.
    }
}
```

## Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage
Run the application:
```bash
node index.js
```
