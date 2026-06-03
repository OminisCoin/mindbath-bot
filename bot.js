// bot.js - MindBath Telegram Bot
import { Telegraf } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

// ===== CONFIGURATION =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const BATH_MINT_ADDRESS = process.env.BATH_MINT_ADDRESS;
const MIN_HOLDINGS = 1000000; // 1,000,000 $BATH
const PRIVATE_CHANNEL_ID = process.env.PRIVATE_CHANNEL_ID;
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const PORT = process.env.PORT || 3000;

// Check if all required variables are set
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing in .env file');
  process.exit(1);
}
if (!BATH_MINT_ADDRESS) {
  console.error('❌ BATH_MINT_ADDRESS is missing in .env file');
  process.exit(1);
}
if (!PRIVATE_CHANNEL_ID) {
  console.error('❌ PRIVATE_CHANNEL_ID is missing in .env file');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const connection = new Connection(RPC_ENDPOINT);
const BATH_MINT = new PublicKey(BATH_MINT_ADDRESS);

console.log('✅ Configuration loaded successfully');

// ===== FUNCTION: Check if wallet holds enough $BATH =====
async function checkHoldings(walletAddress) {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccount = await getAssociatedTokenAddress(BATH_MINT, walletPubkey);
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    const balanceAmount = balance.value.uiAmount || 0;
    
    return {
      holds: balanceAmount >= MIN_HOLDINGS,
      balance: balanceAmount
    };
  } catch (error) {
    return { holds: false, balance: 0 };
  }
}

// ===== FUNCTION: Generate single-use invite link =====
async function generateInviteLink() {
  try {
    const invite = await bot.telegram.createChatInviteLink(PRIVATE_CHANNEL_ID, {
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 3600
    });
    return invite.invite_link;
  } catch (error) {
    console.error('Failed to create invite link:', error);
    throw new Error('Could not generate invite link');
  }
}

// ===== COMMAND: /start =====
bot.start(async (ctx) => {
  await ctx.reply(
    `🛁 *Welcome to MindBath!* 🛁\n\n` +
    `The AI-powered utility meme coin on Solana.\n\n` +
    `Use /verify <your_solana_wallet> to access exclusive holder benefits.\n` +
    `Type /help to see all commands.`,
    { parse_mode: 'Markdown' }
  );
});

// ===== COMMAND: /help =====
bot.help(async (ctx) => {
  await ctx.reply(
    `*Available Commands* 🛁\n\n` +
    `/start - Welcome message and project info\n` +
    `/help - Show this help message\n` +
    `/verify <wallet> - Verify $BATH holdings for exclusive access\n` +
    `/signals - Info about weekly trading signals\n` +
    `/drop - Info about weekly NFT drops`,
    { parse_mode: 'Markdown' }
  );
});

// ===== COMMAND: /verify (MAIN FEATURE) =====
bot.command('verify', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const wallet = args[1];
  
  if (!wallet) {
    return ctx.reply(
      '❌ *Missing wallet address*\n\n' +
      'Please provide your Solana wallet address.\n' +
      'Example: `/verify 7nx3o9g8J3kL2mN4pQ5rS6tU7vW8xY9zA1bC2dE3fG`',
      { parse_mode: 'Markdown' }
    );
  }
  
  if (!wallet.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
    return ctx.reply(
      '❌ *Invalid wallet address*\n\n' +
      'Please provide a valid Solana wallet address.\n' +
      'Example: `/verify 7nx3o9g8J3kL2mN4pQ5rS6tU7vW8xY9zA1bC2dE3fG`',
      { parse_mode: 'Markdown' }
    );
  }
  
  const checkingMsg = await ctx.reply('🔍 *Checking your $BATH holdings...*', { parse_mode: 'Markdown' });
  
  try {
    const { holds, balance } = await checkHoldings(wallet);
    
    if (holds) {
      const inviteLink = await generateInviteLink();
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        checkingMsg.message_id,
        undefined,
        `✅ *VERIFIED!* 🛁\n\n` +
        `You hold ${balance.toLocaleString()} $BATH\n` +
        `(Minimum required: ${MIN_HOLDINGS.toLocaleString()})\n\n` +
        `[Click here to join the MindBath Holders Club](${inviteLink})\n\n` +
        `*Welcome to the inner circle!* 🛁`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        checkingMsg.message_id,
        undefined,
        `❌ *Not Verified*\n\n` +
        `You hold ${balance.toLocaleString()} $BATH\n` +
        `(Minimum required: ${MIN_HOLDINGS.toLocaleString()})\n\n` +
        `Hold at least 1,000,000 $BATH to access the private holders channel.\n\n` +
        `Get more $BATH and try again! 🛁`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Verification error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      checkingMsg.message_id,
      undefined,
      '⚠️ *Verification service temporarily unavailable*\n\nPlease try again in a few moments.',
      { parse_mode: 'Markdown' }
    );
  }
});

// ===== COMMAND: /signals and /drop =====
bot.command(['signals', 'drop'], async (ctx) => {
  await ctx.reply(
    `📊 *Weekly Trading Signals & Drops* 📊\n\n` +
    `Weekly signals and NFT drops are posted exclusively in the *private Holders channel*.\n\n` +
    `Verify your $BATH holdings with /verify to gain access! 🛁`,
    { parse_mode: 'Markdown' }
  );
});

// ===== EVENT: New member joins group =====
bot.on('new_chat_members', async (ctx) => {
  const newMember = ctx.message.new_chat_members[0];
  if (newMember.id === ctx.botInfo.id) {
    await ctx.reply(
      `🛁 *MindBath has entered the chat!* 🛁\n\n` +
      `I'm here to verify $BATH holders and grant access to exclusive content.\n\n` +
      `Holders: Use /verify <wallet> to join the private club!\n` +
      `Everyone: Type /help to see what I can do.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ===== START SERVER =====
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    bot: 'MindBath Verification Bot',
    time: new Date().toISOString()
  });
});

app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  const isProduction = process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
  
  if (isProduction) {
    const publicUrl = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    const webhookUrl = `${publicUrl}/webhook/${BOT_TOKEN}`;
    
    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook set to: ${webhookUrl}`);
      console.log(`🤖 Bot is running in PRODUCTION mode`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
    }
  } else {
    console.log(`📡 Running in DEVELOPMENT mode (polling)`);
    console.log(`🤖 Bot is running locally`);
    bot.launch();
  }
});

process.once('SIGINT', () => {
  console.log('Shutting down...');
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log('Shutting down...');
  bot.stop('SIGTERM');
  process.exit(0);
});
