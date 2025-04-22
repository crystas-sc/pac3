import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import readline from 'readline';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const envPath = path.resolve(process.cwd(), '.env.yaml');
let envConfig = loadEnvConfig();

function loadEnvConfig() {
    try {
        if (fs.existsSync(envPath)) {
            const fileContents = fs.readFileSync(envPath, 'utf8');
            const config = yaml.load(fileContents);
            for (const key in config) {
                process.env[key] = config[key];
            }
            return config;
        }
    } catch (error) {
        console.error("Failed to load environment configuration:", error);
    }
    return {};
}

function saveEnvConfig() {
    try {
        fs.writeFileSync(envPath, yaml.dump(envConfig), 'utf8');
    } catch (error) {
        console.error("Failed to save environment configuration:", error);
    }
}

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
        envConfig.deviceCode = respJson.device_code;
        envConfig.userCode = respJson.user_code;
        envConfig.verification_uri = respJson.verification_uri;
        saveEnvConfig();

        console.log(`Please open ${envConfig.verification_uri} and enter the code ${respJson.user_code}`);
        pollAccessToken(respJson.interval, envConfig.proxyUrl ? new HttpsProxyAgent(envConfig.proxyUrl) : null);
    } catch (error) {
        console.error("Error in getUserAndDeviceCode:", error);
    }
}

function pollAccessToken(interval, proxyAgent) {
    const intervalId = setInterval(async () => {
        try {
            console.log("Attempting to fetch access token...");
            const accessToken = await getAccessToken(proxyAgent);
            if (accessToken) {
                console.log("Access token retrieved successfully. Please run the command again.");
                clearInterval(intervalId);
                envConfig.accessToken = accessToken;
                saveEnvConfig();
            } else {
                console.log("Waiting to retry...");
            }
        } catch (error) {
            console.error("Failed to fetch access token. Retrying...", error);
        }
    }, interval  * 10000);
}

async function getAccessToken(proxyAgent) {
    try {
        const headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
        const body = JSON.stringify({
            "client_id": envConfig.clientId,
            "device_code": envConfig.deviceCode,
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
        });

        const fetchOptions = {
            method: 'POST',
            headers,
            body,
            redirect: 'follow'
        };

        if (proxyAgent) {
            fetchOptions.agent = proxyAgent;
        }

        const response = await fetch("https://github.com/login/oauth/access_token", fetchOptions);

        if (!response.ok) {
            throw new Error(`Failed to fetch access token: ${response.statusText}`);
        }

        const respJson = await response.json();
        console.log("Access token response:", respJson);
        return respJson.access_token;
    } catch (error) {
        console.error("Error in getAccessToken:", error);
        return null;
    }
}

async function chatCompletion(prompt) {
    try {
        if (!envConfig.expiresAt || new Date().getTime() >= new Date(envConfig.expiresAt * 1000).getTime()) {
            console.log("Bearer token expired, generating new bearer token...");
            await genNewBearerToken();
        }

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${envConfig.bearerToken}`,
            "X-Request-Start": "t=1745227472808",
            "User-Agent": "axios/1.6.0"
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

async function genNewBearerToken() {
    try {
        const headers = {
            "Authorization": `token ${envConfig.accessToken}`
        };

        const response = await fetch("https://api.github.com/copilot_internal/v2/token", {
            method: 'GET',
            headers,
            redirect: 'follow',
            agent: envConfig.proxyUrl?  new HttpsProxyAgent(envConfig.proxyUrl) : undefined
        });

        if (!response.ok) {
            throw new Error(`Failed to generate new bearer token: ${response.statusText}`);
        }

        const respJson = await response.json();
        // console.log("Bearer token response:", respJson);
        envConfig.bearerToken = respJson.token;
        envConfig.expiresAt = respJson["expires_at"];
        saveEnvConfig();
    } catch (error) {
        console.error("Error in genNewBearerToken:", error);
    }
}

function startUserStoryPrompt() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter User story Title: ', async (input) => {
        const promptTmpl = `Create user story for developer role with rephrased title, description and acceptance criteria for title: ${input}

        Note: response should be in only JSON format with keys: (title, description, acceptanceCriteria) and should not include any additional text or explanation or markdown text.
        `;
        const result = await chatCompletion(promptTmpl);
        if (result) {
            console.log(result);
        } else {
            console.error("Failed to generate user story.");
        }
        rl.close();
    });
}

if (!envConfig.accessToken) {
    console.log("Access token not found. Initiating device code flow...");
    getUserAndDeviceCode();
} else {
    startUserStoryPrompt();
}