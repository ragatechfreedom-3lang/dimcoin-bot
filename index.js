const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Konfigurasi dari environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_NAME = 'blockchain';
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} online!`);
  console.log('Ready to validate blocks...');
});

client.on('messageCreate', async (message) => {
  console.log(`[${message.channel.name}] ${message.author.tag}: ${message.content}`);
  
  if (message.channel.name !== CHANNEL_NAME) return;
  if (message.author.bot) return;
  
  // Command: !chain
  if (message.content === '!chain') {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('⛏️ Dimcoin Blockchain')
      .setDescription('Bot aktif! Ready to mine.')
      .addFields(
        { name: 'Status', value: '✅ Online', inline: true },
        { name: 'Channel', value: `#${CHANNEL_NAME}`, inline: true }
      );
    
    await message.reply({ embeds: [embed] });
    return;
  }
  
  // Submit block
  if (message.content.startsWith('⛏️ SUBMIT_BLOCK')) {
    await message.channel.sendTyping();
    
    try {
      const jsonStr = message.content.replace('⛏️ SUBMIT_BLOCK\n', '');
      const block = JSON.parse(jsonStr);
      
      console.log('Validating block #', block.index);
      
      const isValid = await validateBlock(block);
      
      if (isValid) {
        const saved = await saveToGist(block);
        
        if (saved) {
          await message.react('✅');
          
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`⛏️ Block #${block.index} Validated!`)
            .setDescription(`Mined by **${block.miner}**`)
            .addFields(
              { name: 'Hash', value: `\`${block.hash.substring(0, 20)}...\``, inline: true },
              { name: 'Nonce', value: `${block.nonce}`, inline: true },
              { name: 'Time', value: `${block.time_taken?.toFixed(2) || '?'}s`, inline: true }
            )
            .setTimestamp();
          
          await message.channel.send({ embeds: [embed] });
          console.log('✅ Block saved!');
        } else {
          await message.react('⚠️');
          await message.reply('Valid tapi gagal save ke Gist!');
        }
      } else {
        await message.react('❌');
        await message.reply('❌ Block invalid!');
      }
      
    } catch (err) {
      console.error('Error:', err);
      await message.react('💥');
    }
  }
});

async function validateBlock(block) {
  try {
    const response = await axios.get(
      `https://gist.githubusercontent.com/${process.env.GITHUB_USERNAME}/${GIST_ID}/raw/blockchain.json`,
      { timeout: 10000 }
    );
    
    const data = response.data;
    const chain = data.chain || [];
    
    const expectedIndex = chain.length;
    if (block.index !== expectedIndex) {
      console.log('Invalid index:', block.index, 'expected:', expectedIndex);
      return false;
    }
    
    const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : 
      '0000000000000000000000000000000000000000000000000000000000000000';
    
    if (block.previous_hash !== prevHash) {
      console.log('Invalid previous hash');
      return false;
    }
    
    const crypto = require('crypto');
    const dataString = `${block.index}${block.previous_hash}${block.timestamp}${block.data}${block.nonce}`;
    const verifyHash = crypto.createHash('sha256').update(dataString).digest('hex');
    
    if (verifyHash !== block.hash) return false;
    if (!block.hash.startsWith('0000')) return false;
    
    return true;
    
  } catch (err) {
    console.error('Validation error:', err.message);
    const crypto = require('crypto');
    const dataString = `${block.index}${block.previous_hash}${block.timestamp}${block.data}${block.nonce}`;
    const verifyHash = crypto.createHash('sha256').update(dataString).digest('hex');
    return verifyHash === block.hash && block.hash.startsWith('0000');
  }
}

async function saveToGist(newBlock) {
  try {
    const getResponse = await axios.get(
      `https://api.github.com/gists/${GIST_ID}`,
      { headers: { 'Authorization': `token ${GITHUB_TOKEN}` }, timeout: 10000 }
    );
    
    const currentContent = getResponse.data.files['blockchain.json'].content;
    const data = JSON.parse(currentContent);
    
    data.chain.push(newBlock);
    data.metadata.total_blocks = data.chain.length;
    data.metadata.last_updated = Math.floor(Date.now() / 1000);
    
    const updateResponse = await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      { files: { 'blockchain.json': { content: JSON.stringify(data, null, 2) } } },
      { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }, timeout: 10000 }
    );
    
    return updateResponse.status === 200 || updateResponse.status === 201;
    
  } catch (err) {
    console.error('Gist save error:', err.message);
    return false;
  }
}

// Keep alive
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Dimcoin Bot is running!');
});
server.listen(3000, () => console.log('Keep-alive server on port 3000'));

client.login(DISCORD_TOKEN);
