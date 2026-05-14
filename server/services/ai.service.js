import axios from 'axios';
import sshService from './ssh.service.js';
import dockerService from './docker.service.js';
import { query } from '../database/init.js';
import logger from '../utils/logger.js';

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'executeSSHCommand',
      description: 'Execute a shell command on a remote server via SSH',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'ID of the server to run the command on' },
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['serverId', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getServerMetrics',
      description: 'Get real-time CPU, memory, disk and load metrics for a server',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID' },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listContainers',
      description: 'List all Docker containers on a server',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID, or null for local Docker' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getContainerLogs',
      description: 'Fetch recent logs from a Docker container',
      parameters: {
        type: 'object',
        properties: {
          containerId: { type: 'string', description: 'Container ID or name' },
          tail: { type: 'number', description: 'Number of lines to return (default 100)' },
          serverId: { type: 'number', description: 'Server ID, or null for local Docker' },
        },
        required: ['containerId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'controlContainer',
      description: 'Start, stop or restart a Docker container',
      parameters: {
        type: 'object',
        properties: {
          containerId: { type: 'string', description: 'Container ID or name' },
          action: { type: 'string', enum: ['start', 'stop', 'restart'] },
          serverId: { type: 'number', description: 'Server ID, or null for local Docker' },
        },
        required: ['containerId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDeployments',
      description: 'Get deployment history',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results to return (default 10)' },
          environment: { type: 'string', description: 'Filter by environment (production, staging, development)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAlerts',
      description: 'Get active system alerts, optionally filtered by server',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID to filter by, or null for all servers' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyzeLogPattern',
      description: 'Search a log file on a server for a pattern and return matching lines',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID' },
          logPath: { type: 'string', description: 'Absolute path to the log file' },
          pattern: { type: 'string', description: 'String pattern to search for' },
        },
        required: ['serverId', 'logPath', 'pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProcessList',
      description: 'Get the list of running processes on a server, sorted by CPU usage',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID' },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkNetworkConnections',
      description: 'List open listening network ports on a server',
      parameters: {
        type: 'object',
        properties: {
          serverId: { type: 'number', description: 'Server ID' },
        },
        required: ['serverId'],
      },
    },
  },
];

class AIService {
  constructor() {
    this.apiUrl = process.env.AI_API_URL || 'http://localhost:11434/v1/chat/completions';
    this.model = process.env.AI_MODEL || 'llama3.2';
    this.apiKey = process.env.AI_API_KEY || '';
  }

  get headers() {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  async callAPI(messages, useTools = true) {
    const body = {
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    };

    if (useTools) {
      body.tools = TOOL_DEFINITIONS;
      body.tool_choice = 'auto';
    }

    const response = await axios.post(this.apiUrl, body, { headers: this.headers });
    return response.data.choices[0].message;
  }

  async chat(messages, conversationId = null, userId = null) {
    try {
      const systemPrompt = this.getSystemPrompt();
      const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

      const assistantMessage = await this.callAPI(fullMessages);

      // Handle tool calls (OpenAI function calling format)
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults = [];
        const toolsUsed = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const { name, arguments: argsStr } = toolCall.function;
          let args = {};
          try { args = JSON.parse(argsStr); } catch { /* ignore */ }

          logger.info(`AI tool call: ${name}(${argsStr})`);
          toolsUsed.push({ toolName: name, params: args });

          let result;
          try {
            result = await this.executeTool(name, args);
          } catch (err) {
            result = { error: err.message };
          }

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Send tool results back to AI for final answer
        const followUpMessages = [
          ...fullMessages,
          assistantMessage,
          ...toolResults,
        ];

        const finalMessage = await this.callAPI(followUpMessages, false);

        return {
          message: finalMessage.content,
          toolsUsed,
        };
      }

      return {
        message: assistantMessage.content,
        toolsUsed: [],
      };
    } catch (error) {
      logger.error('AI Service Error:', error);
      throw new Error(`AI service failed: ${error.message}`);
    }
  }

  async executeTool(name, args) {
    switch (name) {
      case 'executeSSHCommand':
        return sshService.executeCommand(args.serverId, args.command);

      case 'getServerMetrics':
        return sshService.getSystemMetrics(args.serverId);

      case 'listContainers':
        return dockerService.listContainers(args.serverId ?? null);

      case 'getContainerLogs':
        return dockerService.getContainerLogs(args.containerId, args.tail ?? 100, args.serverId ?? null);

      case 'controlContainer': {
        const actions = {
          start: () => dockerService.startContainer(args.containerId, args.serverId ?? null),
          stop: () => dockerService.stopContainer(args.containerId, args.serverId ?? null),
          restart: () => dockerService.restartContainer(args.containerId, args.serverId ?? null),
        };
        if (!actions[args.action]) throw new Error('Invalid action');
        return actions[args.action]();
      }

      case 'getDeployments': {
        let sql = 'SELECT * FROM deployments';
        const params = [];
        if (args.environment) {
          sql += ' WHERE environment = $1';
          params.push(args.environment);
        }
        sql += ' ORDER BY started_at DESC LIMIT $' + (params.length + 1);
        params.push(args.limit ?? 10);
        const r = await query(sql, params);
        return r.rows;
      }

      case 'getAlerts': {
        let sql = "SELECT * FROM alerts WHERE status = 'active'";
        const params = [];
        if (args.serverId) { sql += ' AND server_id = $1'; params.push(args.serverId); }
        sql += ' ORDER BY triggered_at DESC';
        const r = await query(sql, params);
        return r.rows;
      }

      case 'analyzeLogPattern': {
        const logs = await sshService.readLogs(args.serverId, args.logPath, 1000);
        const lines = logs.split('\n');
        const matches = lines.filter((l) => l.includes(args.pattern));
        return { totalLines: lines.length, matchCount: matches.length, matches: matches.slice(0, 50) };
      }

      case 'getProcessList':
        return sshService.getProcesses(args.serverId);

      case 'checkNetworkConnections':
        return sshService.getNetworkConnections(args.serverId);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  getSystemPrompt() {
    return `You are DevOpsMind AI, an expert DevOps assistant with access to live server infrastructure.

You can monitor servers, manage Docker containers, inspect deployments, analyze logs, and troubleshoot issues.

You have access to tools — use them proactively to fetch real data before answering.
Always explain what you find and suggest concrete actions when problems are detected.
Format technical output (commands, logs, configs) in code blocks.`;
  }

  async analyzeLogs(logs) {
    const response = await this.callAPI([{
      role: 'user',
      content: `Analyze these logs. Identify errors, warnings, severity levels, and recommended actions:\n\n${logs}`,
    }], false);
    return response.content;
  }
}

export default new AIService();
