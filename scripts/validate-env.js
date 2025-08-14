#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates required environment variables and configuration on startup
 */

require('dotenv').config();

const requiredEnvVars = [
  {
    name: 'OPENAI_API_KEY',
    required: false, // Optional for basic functionality
    description: 'OpenAI API key for text correction functionality',
    validator: (value) => {
      if (!value) return { valid: true, warning: 'OpenAI API key not set - text correction will be disabled' };
      if (!value.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API key must start with "sk-"' };
      }
      if (value.length < 20) {
        return { valid: false, error: 'OpenAI API key appears to be too short' };
      }
      return { valid: true };
    }
  },
  {
    name: 'PORT',
    required: false, // Has default value
    description: 'Server port number',
    validator: (value) => {
      if (!value) return { valid: true }; // Will use default
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return { valid: false, error: 'PORT must be a valid number between 1 and 65535' };
      }
      return { valid: true };
    }
  },
  {
    name: 'MAX_FILE_SIZE',
    required: false, // Has default value
    description: 'Maximum file size in bytes',
    validator: (value) => {
      if (!value) return { valid: true }; // Will use default
      const size = parseInt(value, 10);
      if (isNaN(size) || size < 1024) {
        return { valid: false, error: 'MAX_FILE_SIZE must be a valid number >= 1024 bytes' };
      }
      return { valid: true };
    }
  },
  {
    name: 'NODE_ENV',
    required: false, // Has default behavior
    description: 'Application environment (development, production, test)',
    validator: (value) => {
      if (!value) return { valid: true }; // Will default to development behavior
      const validEnvs = ['development', 'production', 'test'];
      if (!validEnvs.includes(value)) {
        return { 
          valid: true, 
          warning: `NODE_ENV "${value}" is not standard. Expected: ${validEnvs.join(', ')}` 
        };
      }
      return { valid: true };
    }
  }
];

/**
 * Validates all environment variables
 * @returns {Object} Validation results
 */
function validateEnvironment() {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    config: {}
  };

  console.log('🔍 Validating environment configuration...\n');

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    const validation = envVar.validator(value);

    // Store the configuration value (with defaults)
    results.config[envVar.name] = value || getDefaultValue(envVar.name);

    if (!validation.valid) {
      results.valid = false;
      results.errors.push({
        variable: envVar.name,
        error: validation.error,
        description: envVar.description
      });
      console.log(`❌ ${envVar.name}: ${validation.error}`);
    } else {
      if (validation.warning) {
        results.warnings.push({
          variable: envVar.name,
          warning: validation.warning,
          description: envVar.description
        });
        console.log(`⚠️  ${envVar.name}: ${validation.warning}`);
      } else {
        const displayValue = envVar.name === 'OPENAI_API_KEY' && value ? 
          `${value.substring(0, 8)}...` : 
          (value || 'default');
        console.log(`✅ ${envVar.name}: ${displayValue}`);
      }
    }
  }

  return results;
}

/**
 * Gets default values for environment variables
 * @param {string} varName - Environment variable name
 * @returns {string|number} Default value
 */
function getDefaultValue(varName) {
  const defaults = {
    'PORT': 3000,
    'MAX_FILE_SIZE': 10485760, // 10MB
    'NODE_ENV': 'development'
  };
  return defaults[varName] || null;
}

/**
 * Displays configuration summary
 * @param {Object} config - Configuration object
 */
function displayConfigSummary(config) {
  console.log('\n📋 Configuration Summary:');
  console.log(`   Environment: ${config.NODE_ENV || 'development'}`);
  console.log(`   Port: ${config.PORT || 3000}`);
  console.log(`   Max File Size: ${formatBytes(config.MAX_FILE_SIZE || 10485760)}`);
  console.log(`   OpenAI Integration: ${config.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
}

/**
 * Formats bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main validation function
 */
function main() {
  const results = validateEnvironment();

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Found ${results.warnings.length} warning(s):`);
    results.warnings.forEach(warning => {
      console.log(`   • ${warning.variable}: ${warning.warning}`);
    });
  }

  if (!results.valid) {
    console.log(`\n❌ Environment validation failed with ${results.errors.length} error(s):`);
    results.errors.forEach(error => {
      console.log(`   • ${error.variable}: ${error.error}`);
      console.log(`     Description: ${error.description}`);
    });
    console.log('\n💡 Please check your .env file or environment variables.');
    console.log('   You can copy .env.template to .env and fill in the values.');
    process.exit(1);
  }

  displayConfigSummary(results.config);
  
  console.log('\n✅ Environment validation passed!');
  
  // Only show .env template hint if running standalone (not as part of npm script)
  if (process.argv[1].includes('validate-env.js') && !process.env.OPENAI_API_KEY) {
    console.log('\n💡 Tip: Copy .env.template to .env and add your OpenAI API key to enable text correction.');
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  getDefaultValue,
  formatBytes
};