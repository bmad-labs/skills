#!/usr/bin/env node

/**
 * Atlassian REST API setup validator.
 * Node.js 18+ — zero dependencies, uses built-in fetch.
 *
 * Usage: node setup.mjs
 */

const REQUIRED_VARS = ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_DOMAIN'];

function printSetupGuide(missing) {
  console.log('\n--- Atlassian REST API Setup ---\n');
  console.log(`Missing environment variable(s): ${missing.join(', ')}\n`);
  console.log('Follow these steps to configure your Atlassian credentials:\n');

  console.log('1. Create an API token');
  console.log('   Open: https://id.atlassian.com/manage-profile/security/api-tokens');
  console.log('   Click "Create API token", give it a label, and copy the value.\n');

  console.log('2. Identify your Atlassian domain');
  console.log('   This is the subdomain you use to access Jira/Confluence,');
  console.log('   e.g. "mycompany.atlassian.net"\n');

  console.log('3. Export the variables in your terminal:\n');
  console.log('   export ATLASSIAN_EMAIL="you@example.com"');
  console.log('   export ATLASSIAN_DOMAIN="mycompany.atlassian.net"');
  console.log('   export ATLASSIAN_API_TOKEN="your-api-token"\n');

  console.log('4. To persist across sessions, add the exports to your shell profile');
  console.log('   (~/.bashrc, ~/.zshrc) or store them in a .env file and source it:\n');
  console.log('   echo \'export ATLASSIAN_EMAIL="you@example.com"\' >> ~/.zshrc');
  console.log('   echo \'export ATLASSIAN_DOMAIN="mycompany.atlassian.net"\' >> ~/.zshrc');
  console.log('   echo \'export ATLASSIAN_API_TOKEN="your-api-token"\' >> ~/.zshrc\n');

  console.log('Once set, re-run this script to validate your setup.');
}

async function validate(email, token, domain) {
  const url = `https://${domain}/rest/api/3/myself`;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    console.error(`\nNetwork error: unable to reach ${domain}`);
    console.error(`Details: ${err.message}`);
    return false;
  }

  if (!response.ok) {
    const status = response.status;
    console.error(`\nAPI request failed with status ${status}`);

    if (status === 401) {
      console.error('The API token or email is invalid. Double-check both values.');
    } else if (status === 403) {
      console.error('Permission denied. Your token may lack the required scopes,');
      console.error('or your account does not have access to this Atlassian site.');
    } else if (status === 404) {
      console.error(`Domain "${domain}" was not found. Verify ATLASSIAN_DOMAIN is correct.`);
    } else {
      try {
        const body = await response.text();
        console.error(`Response: ${body}`);
      } catch {
        // ignore parse errors
      }
    }
    return false;
  }

  const user = await response.json();

  console.log('\nAtlassian API connection successful!\n');
  console.log(
    JSON.stringify(
      {
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        accountId: user.accountId,
      },
      null,
      2,
    ),
  );
  return true;
}

async function main() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    printSetupGuide(missing);
    process.exit(1);
  }

  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const domain = process.env.ATLASSIAN_DOMAIN;

  const ok = await validate(email, token, domain);
  process.exit(ok ? 0 : 1);
}

main();
