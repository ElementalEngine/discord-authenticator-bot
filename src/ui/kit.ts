import {
  ActionRowBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  type ButtonBuilder,
} from 'discord.js';

// Auth's look: one accent and one mark per outcome, a key in every title.
const TONES = {
  info: { colour: 0x4f7cac, emoji: 'ℹ️' },
  working: { colour: 0x8a9bb0, emoji: '⏳' },
  success: { colour: 0x3e9b6b, emoji: '✅' },
  refused: { colour: 0xd9822b, emoji: '‼️' },
  failed: { colour: 0xc8443c, emoji: '⚠️' },
} as const;

export type Tone = keyof typeof TONES;

export type Panel = Readonly<{
  tone: Tone;
  title?: string;
  lines: readonly string[];
  buttons?: readonly ButtonBuilder[];
  footer?: string;
}>;

const MARK = '🔑';
// Discord rejects a Components V2 message over 4000 characters of text.
const TEXT_LIMIT = 3900;

function fit(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}\u2026`;
}

export function container(panel: Panel): ContainerBuilder {
  const box = new ContainerBuilder().setAccentColor(TONES[panel.tone].colour);
  const title = panel.title ? `## ${MARK} ${panel.title}` : '';
  const footer = panel.footer ? `-# ${panel.footer}` : '';
  const body = fit(panel.lines.join('\n'), TEXT_LIMIT - title.length - footer.length) || '\u200b';
  if (title) {
    box.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
    box.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  if (footer) box.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  if (panel.buttons?.length) box.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...panel.buttons));
  return box;
}

// A one-line answer to the person who acted.
export const notice = (tone: Tone, text: string): Panel => ({ tone, lines: [`${TONES[tone].emoji} ${text}`] });
