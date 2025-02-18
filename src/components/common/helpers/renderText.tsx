import type { TeactNode } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import type { TextPart } from '../../../types';

import {
  BASE_URL,
  IS_PACKAGED_ELECTRON,
} from '../../../config';
import EMOJI_REGEX from '../../../lib/twemojiRegex';
import buildClassName from '../../../util/buildClassName';
import { isDeepLink } from '../../../util/deepLinkParser';
import {
  handleEmojiLoad,
  LOADED_EMOJIS,
  nativeToUnifiedExtendedWithCache,
} from '../../../util/emoji/emoji';
import fixNonStandardEmoji from '../../../util/emoji/fixNonStandardEmoji';
import { compact } from '../../../util/iteratees';
import { IS_EMOJI_SUPPORTED } from '../../../util/windowEnvironment';

import MentionLink from '../../middle/message/MentionLink';
import SafeLink from '../SafeLink';

export type TextFilter = (
  'escape_html' | 'hq_emoji' | 'emoji' | 'emoji_html' | 'br' | 'br_html' | 
  'highlight' | 'links' | 'simple_markdown' | 'simple_markdown_html' | 
  'quote' | 'tg_links' | 'remove_icon_emoji'
);

interface TextToken {
  type: 'text' | 'bold' | 'italic' | 'link' | 'mention';
  content: string;
  metadata?: {
    url?: string;
    isHtml?: boolean;
  };
}

class TextParser {
  private text: string;
  private position: number;

  constructor(text: string) {
    this.text = text;
    this.position = 0;
  }

  parseText(): TextToken[] {
    const tokens: TextToken[] = [];
    let plainText = '';

    while (this.position < this.text.length) {
      const char = this.text[this.position];
      const nextChar = this.text[this.position + 1];

      // Parse markdown
      if (char === '*' && nextChar === '*') {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const boldResult = this.parseBold();
        if (boldResult) {
          tokens.push(boldResult);
          continue;
        }
      }

      if (char === '_' && nextChar === '_') {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const italicResult = this.parseItalic();
        if (italicResult) {
          tokens.push(italicResult);
          continue;
        }
      }

      // Parse mentions
      if (char === '@') {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const mentionResult = this.parseMention();
        if (mentionResult) {
          tokens.push(mentionResult);
          continue;
        }
      }

      // Parse links
      if ((char === 'h' && this.checkNextChars('https://')) || 
          (char === 't' && this.checkNextChars('tg://'))) {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const linkResult = this.parseLink();
        if (linkResult) {
          tokens.push(linkResult);
          continue;
        }
      }

      plainText += char;
      this.position++;
    }

    if (plainText) {
      tokens.push({ type: 'text', content: plainText });
    }

    return tokens;
  }

  private checkNextChars(str: string): boolean {
    return this.text.slice(this.position, this.position + str.length) === str;
  }

  private parseMention(): TextToken | null {
    const startPos = this.position;
    let content = '@';
    this.position++; // Skip @

    while (this.position < this.text.length) {
      const char = this.text[this.position];
      if (!/[a-zA-Z0-9_]/.test(char)) {
        break;
      }
      content += char;
      this.position++;
    }

    if (content.length > 1) {
      return { type: 'mention', content };
    }

    this.position = startPos;
    return null;
  }

  private parseLink(): TextToken | null {
    const startPos = this.position;
    let content = '';

    while (this.position < this.text.length) {
      const char = this.text[this.position];
      if (char === ' ' || char === '\n') {
        break;
      }
      content += char;
      this.position++;
    }

    if (content.startsWith('https://') || content.startsWith('tg://')) {
      return {
        type: 'link',
        content,
        metadata: { url: content }
      };
    }

    this.position = startPos;
    return null;
  }

  parseMarkdown(): TextToken[] {
    const tokens: TextToken[] = [];
    let plainText = '';

    while (this.position < this.text.length) {
      const char = this.text[this.position];
      const nextChar = this.text[this.position + 1];

      if (char === '*' && nextChar === '*') {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const boldResult = this.parseBold();
        if (boldResult) {
          tokens.push(boldResult);
          continue;
        }
      }

      if (char === '_' && nextChar === '_') {
        if (plainText) {
          tokens.push({ type: 'text', content: plainText });
          plainText = '';
        }
        const italicResult = this.parseItalic();
        if (italicResult) {
          tokens.push(italicResult);
          continue;
        }
      }

      plainText += char;
      this.position++;
    }

    if (plainText) {
      tokens.push({ type: 'text', content: plainText });
    }

    return tokens;
  }

  private parseBold(): TextToken | null {
    const startPos = this.position;
    this.position += 2; // Skip **
    let content = '';

    while (this.position < this.text.length) {
      if (this.text[this.position] === '*' && this.text[this.position + 1] === '*') {
        this.position += 2;
        return { type: 'bold', content };
      }
      content += this.text[this.position];
      this.position++;
    }

    this.position = startPos;
    return null;
  }

  private parseItalic(): TextToken | null {
    const startPos = this.position;
    this.position += 2; // Skip __
    let content = '';

    while (this.position < this.text.length) {
      if (this.text[this.position] === '_' && this.text[this.position + 1] === '_') {
        this.position += 2;
        return { type: 'italic', content };
      }
      content += this.text[this.position];
      this.position++;
    }

    this.position = startPos;
    return null;
  }
}

function renderTextToken(token: TextToken, params: any, filter: TextFilter): TeactNode {
  switch (token.type) {
    case 'text':
      return token.content;

    case 'bold':
      return filter === 'simple_markdown_html' 
        ? `<b>${token.content}</b>`
        : <b>{token.content}</b>;

    case 'italic':
      return filter === 'simple_markdown_html'
        ? `<i>${token.content}</i>`
        : <i>{token.content}</i>;

    case 'link':
      if (filter === 'tg_links' && !isDeepLink(token.metadata?.url || '')) {
        return token.content;
      }
      return <SafeLink text={token.content} url={token.metadata?.url || token.content} />;

    case 'mention':
      return (
        <MentionLink username={token.content}>
          {token.content}
        </MentionLink>
      );

    default:
      return token.content;
  }
}

function removeIconEmoji(textParts: TextPart[], params: any): TextPart[] {
  // Якщо не ввімкнено, пропускаємо
  if (!params?.removeIconEmoji) {
    return textParts;
  }
  // Якщо offset не 100, теж нічого не робимо
  if (params.removeIconOffset !== 100) {
    return textParts;
  }

  // Якщо взагалі немає текстових частин
  if (!textParts.length) {
    return textParts;
  }

  const firstPart = textParts[0];
  // Якщо перша частина не є рядком - нічого не вирізаємо
  if (typeof firstPart !== 'string') {
    return textParts;
  }

  // Шукаємо емодзі на початку
  EMOJI_REGEX.lastIndex = 0;
  const match = EMOJI_REGEX.exec(firstPart);
  // Якщо знайдено емодзі (match) і воно починається з індексу 0
  if (match && match.index === 0) {
    // Вирізаємо з першого рядка це емодзі
    const newFirstPart = firstPart.slice(match[0].length);

    // Повертаємо оновлену першу частину + решту
    return [newFirstPart, ...textParts.slice(1)];
  }

  // Інакше повертаємо без змін
  return textParts;
}
export default function renderText(
  part: TextPart,
  filters: Array<TextFilter> = ['emoji'],
  params?: {
    highlight?: string;
    quote?: string;
    markdownPostProcessor?: (part: string) => TeactNode;
    removeIconOffset?: number
    removeIconEmoji?: boolean;
  },
): TeactNode[] {
  if (typeof part !== 'string') {
    return [part];
  }

  return compact(filters.reduce((text, filter) => {
    switch (filter) {
      
      case 'escape_html':
        return escapeHtml(text);

      case 'hq_emoji':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'big', 'jsx');

      case 'emoji':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'small', 'jsx');

      case 'emoji_html':
        EMOJI_REGEX.lastIndex = 0;
        return replaceEmojis(text, 'small', 'html');

      case 'br':
        return addLineBreaks(text, 'jsx');

      case 'br_html':
        return addLineBreaks(text, 'html');

      case 'highlight':
        return addHighlight(text, params!.highlight);
      case 'remove_icon_emoji':
        return removeIconEmoji(text, params);
        
      case 'quote':
        return addHighlight(text, params!.quote, true);

        case 'links':
          case 'tg_links':
            return text.reduce((result: TextPart[], textPart) => {
              if (typeof textPart !== 'string') {
                result.push(textPart);
                return result;
              }
          
              const parser = new TextParser(textPart);
              const tokens = parser.parseText();
          
              tokens.forEach((token) => {
                result.push(renderTextToken(token, params, filter));
              });
          
              return result;
            }, []);  
      case 'simple_markdown':
      case 'simple_markdown_html':
        return text.reduce((result: TextPart[], textPart) => {
          if (typeof textPart !== 'string') {
            result.push(textPart);
            return result;
          }

          const parser = new TextParser(textPart);
          const tokens = parser.parseMarkdown();
       
          tokens.forEach((token) => {
            switch (token.type) {
              case 'bold':
                result.push(
                  filter === 'simple_markdown_html'
                    ? `<b>${token.content}</b>`
                    : <b>{token.content}</b>
                );
                break;
              case 'italic':
                result.push(
                  filter === 'simple_markdown_html'
                    ? `<i>${token.content}</i>`
                    : <i>{token.content}</i>
                );
                break;
              default:
                result.push(token.content);
            }
          });

          return result;
        }, []);

      default:
        return text;
    }
  }, [part] as TextPart[]));
}

function replaceEmojis(textParts: TextPart[], size: 'big' | 'small', type: 'jsx' | 'html'): TextPart[] {
  if (IS_EMOJI_SUPPORTED) {
    return textParts;
  }

  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    part = fixNonStandardEmoji(part);
    const parts = part.split(EMOJI_REGEX);
    const emojis: string[] = part.match(EMOJI_REGEX) || [];
    result.push(parts[0]);

    return emojis.reduce((emojiResult: TextPart[], emoji, i) => {
      const code = nativeToUnifiedExtendedWithCache(emoji);
      if (!code) {
        emojiResult.push(emoji);
      } else {
        const baseSrcUrl = IS_PACKAGED_ELECTRON ? BASE_URL : '.';
        const src = `${baseSrcUrl}/img-apple-${size === 'big' ? '160' : '64'}/${code}.png`;
        const className = buildClassName(
          'emoji',
          size === 'small' && 'emoji-small',
        );

        if (type === 'jsx') {
          const isLoaded = LOADED_EMOJIS.has(src);

          emojiResult.push(
            <img
              src={src}
              className={`${className}${!isLoaded ? ' opacity-transition slow shown' : ''}`}
              alt={emoji}
              data-path={src}
              draggable={false}
              onLoad={!isLoaded ? handleEmojiLoad : undefined}
            />,
          );
        }
        if (type === 'html') {
          emojiResult.push(
            `<img\
            draggable="false"\
            class="${className}"\
            src="${src}"\
            alt="${emoji}"\
          />`,
          );
        }
      }

      const index = i * 2 + 2;
      if (parts[index]) {
        emojiResult.push(parts[index]);
      }

      return emojiResult;
    }, result);
  }, []);
}

function escapeHtml(textParts: TextPart[]): TextPart[] {
  const divEl = document.createElement('div');
  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    divEl.innerText = part;
    result.push(divEl.innerHTML);

    return result;
  }, []);
}

function addLineBreaks(textParts: TextPart[], type: 'jsx' | 'html'): TextPart[] {
  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const splittenParts = part
      .split(/\r\n|\r|\n/g)
      .reduce((parts: TextPart[], line: string, i, source) => {
        const trimmedLine = line.trimLeft();
        const indentLength = line.length - trimmedLine.length;
        parts.push(String.fromCharCode(160).repeat(indentLength) + trimmedLine);

        if (i !== source.length - 1) {
          parts.push(
            type === 'jsx' ? <br /> : '<br />',
          );
        }

        return parts;
      }, []);

    return [...result, ...splittenParts];
  }, []);
}

function addHighlight(textParts: TextPart[], highlight?: string, isQuote?: boolean): TextPart[] {
  return textParts.reduce((result: TextPart[], part) => {
    if (typeof part !== 'string' || !highlight) {
      result.push(part);
      return result;
    }

    const partLower = part.toLowerCase();
    const highlightLower = highlight.toLowerCase();
    const index = partLower.indexOf(highlightLower);

    if (index === -1) {
      result.push(part);
      return result;
    }

    result.push(part.substring(0, index));
    result.push(
      <span className={buildClassName('matching-text-highlight', isQuote && 'is-quote')}>
        {part.substring(index, index + highlight.length)}
      </span>,
    );
    result.push(part.substring(index + highlight.length));

    return result;
  }, []);
}

export function areLinesWrapping(text: string, element: HTMLElement) {
  const lines = text.split('\n').length;
  const { lineHeight } = getComputedStyle(element);
  const lineHeightPx = parseFloat(lineHeight);
  
  return element.clientHeight > lines * lineHeightPx;
}