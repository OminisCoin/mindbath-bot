import { Telegraf } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection('https://api.mainnet-beta.solana.com');
const BATH_MINT = new PublicKey(process.env.BATH_MINT_ADDRESS);
const MIN_HOLDINGS = 1000000;

bot.start((ctx) => ctx.reply('Bot is working! 🛁'));

bot.command('testbalance', async (ctx) => {
    const wallet = ctx.message.text.split(' ')[1];
    if (!wallet) return ctx.reply('Usage: /testbalance WALLET_ADDRESS');
    
    await ctx.reply('🔍 Checking...');
    
    try {
        const walletPubkey = new PublicKey(wallet);
        const tokenAccount = await getAssociatedTokenAddress(
            BATH_MINT, walletPubkey, false, TOKEN_2022_PROGRAM_ID
        );
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        ctx.reply(`Balance: ${balance.value.uiAmount} $BATH`);
    } catch (error) {
        ctx.reply(`Error: ${error.message}`);
    }
});

bot.launch();
console.log('Test bot running...');
