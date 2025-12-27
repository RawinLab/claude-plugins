#!/usr/bin/env node

/**
 * Toggle verbose mode for Telegram notifications
 */

import { loadConfig, updateConfig } from '../lib/config.mjs';

const mode = process.argv[2]?.toLowerCase();
const config = loadConfig();

switch (mode) {
  case 'on':
  case 'true':
  case '1':
    updateConfig({ verbose_mode: true });
    console.log('✅ Verbose mode: ON');
    console.log('   All tool events will be sent to Telegram (formatted nicely)');
    break;

  case 'off':
  case 'false':
  case '0':
    updateConfig({ verbose_mode: false });
    console.log('✅ Verbose mode: OFF (Summary mode)');
    console.log('   Only important events will be sent (errors, questions, task complete)');
    break;

  case 'status':
  case undefined:
  case '':
    const current = config.verbose_mode ? 'ON' : 'OFF (Summary)';
    console.log(`📊 Verbose mode: ${current}`);
    console.log('');
    if (config.verbose_mode) {
      console.log('Current: All tool events are sent');
    } else {
      console.log('Current: Only important events are sent');
    }
    console.log('');
    console.log('Usage:');
    console.log('  /telegram-verbose on    Enable verbose mode');
    console.log('  /telegram-verbose off   Enable summary mode (default)');
    break;

  case 'toggle':
    const newValue = !config.verbose_mode;
    updateConfig({ verbose_mode: newValue });
    console.log(`✅ Verbose mode: ${newValue ? 'ON' : 'OFF'}`);
    break;

  default:
    console.log('❌ Invalid mode. Use: on, off, status, or toggle');
    process.exit(1);
}
