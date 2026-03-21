// ─────────────────────────────────────────
//         AKAZA BOT — COMMAND HANDLER
// ─────────────────────────────────────────

const config = require('./config')

// Store all registered commands
const commands = new Map()

/**
 * Register a new command
 * @param {Object} options - Command options
 * @param {string|string[]} options.name - Command name(s) / aliases
 * @param {string} options.description - What the command does
 * @param {string} options.category - Command category (e.g. 'general', 'owner')
 * @param {boolean} options.ownerOnly - Restrict to owner only
 * @param {Function} options.handler - Function to run when command is triggered
 */
const addCommand = ({ name, description = '', category = 'general', ownerOnly = false, handler }) => {
  const names = Array.isArray(name) ? name : [name]

  names.forEach((n) => {
    commands.set(n.toLowerCase(), {
      name: names[0],
      aliases: names.slice(1),
      description,
      category,
      ownerOnly,
      handler,
    })
  })
}

/**
 * Run a command by name
 * @param {string} name - Command name (without prefix)
 * @param {Object} context - { sock, msg, sender, args, isOwner, reply }
 */
const runCommand = async (name, context) => {
  const cmd = commands.get(name.toLowerCase())

  if (!cmd) return false // command not found

  // Owner-only check
  if (cmd.ownerOnly && !context.isOwner) {
    await context.reply(config.messages.ownerOnly)
    return true
  }

  try {
    await cmd.handler(context)
  } catch (err) {
    console.error(`[Akaza] Error in command "${name}":`, err)
    await context.reply(config.messages.error)
  }

  return true
}

/**
 * Get all registered commands
 */
const getCommands = () => commands

/**
 * Get commands grouped by category
 */
const getCommandsByCategory = () => {
  const categories = {}

  commands.forEach((cmd, key) => {
    // Avoid listing aliases as separate entries
    if (cmd.name !== key) return

    const cat = cmd.category
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(cmd)
  })

  return categories
}

module.exports = { addCommand, runCommand, getCommands, getCommandsByCategory }
