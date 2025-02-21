import type { ApiSticker, ApiStickerSet, ApiStickerSetInfo } from '../api/types';
import { IconName } from '../types/icons';
import { FOLDER_SYMBOL_SET_ID } from '../config';

export const emojiToIconMap: Record<string, IconName> = {

  '✅': 'folder-chat',
  '💬':'folder-chats',
  '👤': 'folder-user',
  '👥':"folder-group",
  '⭐': 'folder-star',
  '📢':"folder-channel",
  '🤖': 'folder-bot',
  '💼': 'folder-icon',
};

export function createFolderEmojiSet(): ApiStickerSet {
  const stickers: ApiSticker[] = Object.entries(emojiToIconMap).map(([emoji, iconName], index) => {
    const sticker: ApiSticker = {
      id: `666  ${index}`,
      mediaType: 'sticker',
      isLottie: false,
      isVideo: false,
      stickerSetInfo: {
        shortName: 'folder_emojis',
        id: 'folder-set',
        accessHash: '0',
      },
      emoji,
      isCustomEmoji: true,
      shouldUseTextColor: true,
      hasEffect: false,
      width: 100,
      height: 100,
      thumbnail: {
        dataUri: emoji,
        width:36,
        height:36,
      },
    };

    return sticker;
  });

  return {
    id: FOLDER_SYMBOL_SET_ID,
    accessHash: '0',
    title: 'Folder Icons',
    shortName: 'folder_emojis',
    stickers,
    count: stickers.length,
    isEmoji: true as const,
    installedDate: Date.now(),
    hasThumbnail: false,
    hasStaticThumb: true,
    hasAnimatedThumb: false,
    hasVideoThumb: false,
  };
}