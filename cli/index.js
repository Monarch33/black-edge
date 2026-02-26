#!/usr/bin/env node

/**
 * Black Edge CLI
 * ==============
 * Institutional-grade HFT terminal for prediction market arbitrage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const WebSocket = require('ws');
const axios = require('axios');

// =============================================================================
// Constants
// =============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.blackedge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = process.env.BLACK_EDGE_API || 'https://black-edge-backend-production-e616.up.railway.app';
const DEFAULT_WS_URL = process.env.BLACK_EDGE_WS || 'wss://black-edge-backend-production-e616.up.railway.app/ws/v2/stream';

// =============================================================================
// ASCII Logo
// =============================================================================

const LOGO = chalk.green(`
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  ██████╗ ██╗      █████╗  ██████╗██╗  ██╗                        ║
║  ██╔══██╗██║     ██╔══██╗██╔════╝██║ ██╔╝                        ║
║  ██████╔╝██║     ███████║██║     █████╔╝                         ║
║  ██╔══██╗██║     ██╔══██║██║     ██╔═██╗                         ║
║  ██████╔╝███████╗██║  ██║╚██████╗██║  ██╗                        ║
║  ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝                        ║
║                                                                    ║
║  ███████╗██████╗  ██████╗ ███████╗                                ║
║  ██╔════╝██╔══██╗██╔════╝ ██╔════╝                                ║
║  █████╗  ██║  ██║██║  ███╗█████╗                                  ║
║  ██╔══╝  ██║  ██║██║   ██║██╔══╝                                  ║
║  ███████╗██████╔╝╚██████╔╝███████╗                                ║
║  ╚══════╝╚═════╝  ╚═════╝ ╚══════╝                                ║
║                                                                    ║
║  ${chalk.white('Institutional-Grade HFT Terminal')}                              ║
║  ${chalk.gray('Powered by 5-Agent AI Council')}                                ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`);

// =============================================================================
// Config Management
// =============================================================================

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error(chalk.red('Failed to load config:'), e.message);
      return null;
    }
  }
  return null;
}

function saveConfig(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error(chalk.red('Failed to save config:'), e.message);
    return false;
  }
}

// =============================================================================
// API Functions
// =============================================================================

async function validateApiKey(apiKey) {
  try {
    const response = await axios.get(`${DEFAULT_API_URL}/api/credits/balance`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }
    return { valid: false, error: error.message };
  }
}

// =============================================================================
// Setup Flow
// =============================================================================

async function runSetup() {
  console.clear();
  console.log(LOGO);
  console.log(chalk.cyan('Welcome to Black Edge CLI!\n'));

  // Step 1: API Key
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: chalk.white('Enter your Black Edge API Key:'),
      mask: '•',
      validate: (input) => {
        if (!input) return 'API key is required';
        if (!input.startsWith('be_live_')) return 'API key must start with be_live_';
        return true;
      }
    }
  ]);

  // Step 2: Validate & Check Credits
  const spinner = ora('Validating API key...').start();

  const creditsData = await validateApiKey(apiKey);

  if (creditsData.error || creditsData.valid === false) {
    spinner.fail(chalk.red('Invalid API key!'));
    console.log(chalk.yellow('\nGet your API key at: https://blackedge.io\n'));
    process.exit(1);
  }

  spinner.succeed(chalk.green('API key validated!'));

  // Display credit balance
  const { credits, max_credits, percentage } = creditsData;
  const creditBar = generateProgressBar(percentage);

  console.log(chalk.white('\n💳 Credit Balance:'));
  console.log(chalk.cyan(`   ${creditBar} ${credits.toLocaleString()} / ${max_credits.toLocaleString()}`));

  if (credits === 0) {
    console.log(chalk.red('\n╔════════════════════════════════════════╗'));
    console.log(chalk.red('║   ⚠️  NO API CREDITS REMAINING        ║'));
    console.log(chalk.red('║                                        ║'));
    console.log(chalk.red('║   Purchase more at:                    ║'));
    console.log(chalk.red('║   https://blackedge.io/pricing         ║'));
    console.log(chalk.red('╚════════════════════════════════════════╝\n'));
    process.exit(1);
  }

  if (credits < 1000) {
    console.log(chalk.yellow('\n⚠️  Warning: Low credits! Consider purchasing more.\n'));
  }

  // Step 3-6: Polymarket Keys (Optional)
  console.log(chalk.white('\n🔑 Polymarket Configuration (Optional):'));
  console.log(chalk.gray('Leave blank to skip automated trading\n'));

  const polymarketAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'proxyKey',
      message: 'Polymarket Proxy Key (or press Enter to skip):',
      default: ''
    },
    {
      type: 'password',
      name: 'secret',
      message: 'Polymarket Secret (or press Enter to skip):',
      mask: '•',
      default: '',
      when: (answers) => answers.proxyKey
    },
    {
      type: 'password',
      name: 'passphrase',
      message: 'Polymarket Passphrase (or press Enter to skip):',
      mask: '•',
      default: '',
      when: (answers) => answers.proxyKey
    },
    {
      type: 'password',
      name: 'polygonPrivateKey',
      message: 'Polygon Private Key (or press Enter to skip):',
      mask: '•',
      default: '',
      when: (answers) => answers.proxyKey
    }
  ]);

  // Step 7: Strategy Selection
  const { strategy } = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Select trading strategy:',
      choices: [
        { name: chalk.green('Oracle') + chalk.gray(' — Sentiment-driven signals'), value: 'oracle' },
        { name: chalk.green('Sniper') + chalk.gray(' — Arbitrage opportunities'), value: 'sniper' }
      ],
      default: 'oracle'
    }
  ]);

  // Save config
  const config = {
    apiKey,
    apiUrl: DEFAULT_API_URL,
    wsUrl: DEFAULT_WS_URL,
    strategy,
    polymarket: polymarketAnswers.proxyKey ? {
      proxyKey: polymarketAnswers.proxyKey,
      secret: polymarketAnswers.secret,
      passphrase: polymarketAnswers.passphrase,
      polygonPrivateKey: polymarketAnswers.polygonPrivateKey
    } : null
  };

  if (!saveConfig(config)) {
    console.log(chalk.red('\n❌ Failed to save configuration\n'));
    process.exit(1);
  }

  console.log(chalk.green('\n✅ Configuration saved to ' + CONFIG_FILE + '\n'));

  return config;
}

// =============================================================================
// WebSocket Stream
// =============================================================================

async function startStream(config) {
  console.log(chalk.cyan('\n🚀 Initializing signal stream...\n'));

  const wsUrl = `${config.wsUrl}?api_key=${config.apiKey}&client_type=cli`;

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to Black Edge API\n'));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    } catch (e) {
      console.error(chalk.red('Failed to parse message:'), e.message);
    }
  });

  ws.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error.message);
  });

  ws.on('close', () => {
    console.log(chalk.yellow('\n⚠️  Disconnected from Black Edge API'));
    console.log(chalk.gray('Reconnecting in 5 seconds...\n'));
    setTimeout(() => startStream(config), 5000);
  });

  // Send ping every 30 seconds
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

// =============================================================================
// Message Handlers
// =============================================================================

function handleMessage(message) {
  const { type, data, credits_remaining } = message;

  switch (type) {
    case 'welcome':
      console.log(chalk.green(`💳 Credits: ${data.credits.toLocaleString()} / ${data.max_credits.toLocaleString()}`));
      console.log(chalk.gray(`   Tier: ${data.tier.toUpperCase()}\n`));
      break;

    case 'signal':
      handleSignal(data, credits_remaining);
      break;

    case 'heartbeat':
      // Silent heartbeat
      break;

    case 'error':
      handleError(message);
      break;

    case 'pong':
      // Silent pong
      break;

    default:
      console.log(chalk.gray(`[${type}]`), message);
  }
}

function handleSignal(signal, creditsRemaining) {
  const timestamp = new Date().toLocaleTimeString();

  console.log(chalk.cyan(`\n[${timestamp}] 📡 NEW SIGNAL`));
  console.log(chalk.white(`           Market: ${signal.market || signal.name || 'Unknown'}`));

  if (signal.edge) {
    const edgeColor = signal.edge > 10 ? chalk.green : chalk.yellow;
    console.log(edgeColor(`           Edge: +${signal.edge}%`));
  }

  if (signal.council_vote) {
    console.log(chalk.white(`           Council Vote: ${signal.council_vote}`));
  }

  if (signal.kelly) {
    console.log(chalk.white(`           Kelly: ${signal.kelly}%`));
  }

  if (signal.side) {
    const sideColor = signal.side === 'YES' ? chalk.green : chalk.red;
    console.log(sideColor(`           Side: ${signal.side}`));
  }

  if (creditsRemaining !== undefined) {
    console.log(chalk.gray(`           💳 Credits: ${creditsRemaining.toLocaleString()}`));
  }
}

function handleError(message) {
  const { code, message: errorMessage } = message;

  console.log(chalk.red('\n╔════════════════════════════════════════╗'));
  console.log(chalk.red(`║   ⚠️  ${code || 'ERROR'}                  ║`));
  console.log(chalk.red('║                                        ║'));
  console.log(chalk.red(`║   ${errorMessage}                       ║`));

  if (code === 'INSUFFICIENT_CREDITS') {
    console.log(chalk.red('║                                        ║'));
    console.log(chalk.red('║   Purchase more at:                    ║'));
    console.log(chalk.red('║   https://blackedge.io/pricing         ║'));
  }

  console.log(chalk.red('╚════════════════════════════════════════╝\n'));

  if (code === 'INSUFFICIENT_CREDITS') {
    process.exit(1);
  }
}

// =============================================================================
// Utilities
// =============================================================================

function generateProgressBar(percentage, length = 12) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;

  let color = chalk.green;
  if (percentage < 20) color = chalk.red;
  else if (percentage < 50) color = chalk.yellow;

  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'reset') {
    // Delete config and restart
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      console.log(chalk.green('✅ Configuration reset\n'));
    }
    process.exit(0);
  }

  // Load or create config
  let config = loadConfig();

  if (!config) {
    config = await runSetup();
  } else {
    console.clear();
    console.log(LOGO);
    console.log(chalk.cyan('Welcome back to Black Edge CLI!\n'));
  }

  // Start streaming
  await startStream(config);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Goodbye!\n'));
    process.exit(0);
  });
}

// Run
main().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error.message);
  process.exit(1);
});
