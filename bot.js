// bot.js - MindBath Telegram Bot (WORKING VERSION)
import { Telegraf } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

// ===== CONFIGURATION =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const BATH_MINT_ADDRESS = process.env.BATH_MINT_ADDRESS;
const MIN_HOLDINGS = 1000000;
const PRIVATE_CHANNEL_ID = process.env.PRIVATE_CHANNEL_ID;
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing');
  process.exit(1);
}
if (!BATH_MINT_ADDRESS) {
  console.error('❌ BATH_MINT_ADDRESS is missing');
  process.exit(1);
}
if (!PRIVATE_CHANNEL_ID) {
  console.error('❌ PRIVATE_CHANNEL_ID is missing');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const connection = new Connection(RPC_ENDPOINT);
const BATH_MINT = new PublicKey(BATH_MINT_ADDRESS);

console.log('✅ Configuration loaded');
console.log('🎯 BATH Mint:', BATH_MINT_ADDRESS);
console.log('🔗 Channel ID:', PRIVATE_CHANNEL_ID);

// ===== CHECK BALANCE (WORKS WITH TOKEN-2022) =====
async function checkHoldings(walletAddress) {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccount = await getAssociatedTokenAddress(
      BATH_MINT, 
      walletPubkey, 
      false, 
      TOKEN_2022_PROGRAM_ID  // This is the fix for your token
    );
    
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    const balanceAmount = balance.value.uiAmount || 0;
    
    return {
      holds: balanceAmount >= MIN_HOLDINGS,
      balance: balanceAmount
    };
  } catch (error) {
    console.log('Balance check error:', error.message);
    return { holds: false, balance: 0 };
  }
}

// ===== GENERATE INVITE LINK =====
async function generateInviteLink() {
  try {
    const invite = await bot.telegram.createChatInviteLink(PRIVATE_CHANNEL_ID, {
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 3600
    });
    return invite.invite_link;
  } catch (error) {
    console.error('Invite link error:', error.message);
    throw new Error('Could not generate invite link');
  }
}

// ===== COMMANDS =====
bot.start(async (ctx) => {
  await ctx.reply(
    `🛁 *Welcome to MindBath!* 🛁\n\n` +
    `Use /verify <your_solana_wallet> to check holdings.\n` +
    `Type /help for commands.`,
    { parse_mode: 'Markdown' }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    `*Commands:*\n` +
    `/start - Welcome message\n` +
    `/help - This help\n` +
    `/verify <wallet> - Check $BATH holdings\n` +
    `/signals - Info about weekly signals`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('verify', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const wallet = args[1];
  
  if (!wallet) {
    return ctx.reply(
      '❌ *Missing wallet*\n\nExample: `/verify 852SRcMeipT81yYeMX4ptPseBsq...`',
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
        `You hold ${Math.floor(balance).toLocaleString()} $BATH\n` +
        `(Required: ${MIN_HOLDINGS.toLocaleString()})\n\n` +
        `[Click here to join the Holders Club](${inviteLink})`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        checkingMsg.message_id,
        undefined,
        `❌ *Not Verified*\n\n` +
        `You hold ${Math.floor(balance).toLocaleString()} $BATH\n` +
        `Required: ${MIN_HOLDINGS.toLocaleString()}\n\n` +
        `Get more $BATH and try again! 🛁`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Verify error:', error.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      checkingMsg.message_id,
      undefined,
      `⚠️ *Error*\n\n${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
});

bot.command(['signals', 'drop'], async (ctx) => {
  await ctx.reply(
    `📊 *Weekly Signals & Drops*\n\n` +
    `Exclusive content in the private Holders channel.\n` +
    `Verify with /verify to join! 🛁`,
    { parse_mode: 'Markdown' }
  );
});

// ===== START SERVER =====
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'running', bot: 'MindBath' });
});

app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  const isProduction = process.env.RENDER_EXTERNAL_URL;
  if (isProduction) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook/${BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook set`);
  } else {
    bot.launch();
    console.log(`📡 Running locally`);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
