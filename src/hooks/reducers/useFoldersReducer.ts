import { getGlobal } from '../../global';
import { ApiMessageEntity, ApiMessageEntityTypes, type ApiChatFolder } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { Dispatch, StateReducer } from '../useReducer';
import { selectChat } from '../../global/selectors';
import { omit, pick } from '../../util/iteratees';
import useReducer from '../useReducer';

export type FolderChatType = {
  icon: IconName;
  title: string;
  key: keyof Pick<ApiChatFolder, (
    'contacts' | 'nonContacts' | 'groups' | 'channels' | 'bots' |
    'excludeMuted' | 'excludeArchived' | 'excludeRead'
  )>;
};

const INCLUDE_FILTER_FIELDS: Array<keyof FolderIncludeFilters> = [
  'includedChatIds', 'bots', 'channels', 'groups', 'contacts', 'nonContacts',
];
const EXCLUDE_FILTER_FIELDS: Array<keyof FolderExcludeFilters> = [
  'excludedChatIds', 'excludeArchived', 'excludeMuted', 'excludeRead',
];

export function selectChatFilters(state: FoldersState, mode: 'included' | 'excluded', selectTemp?: boolean) {
  let selectedChatIds: string[] = [];
  let selectedChatTypes: FolderChatType['key'][] = [];

  if (mode === 'included') {
    const {
      includedChatIds,
      ...includeFilters
    } = selectTemp
      ? state.includeFilters || {}
      : pick(
        state.folder,
        INCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = includedChatIds || [];
    selectedChatTypes = (Object.keys(includeFilters) as Array<keyof typeof includeFilters>)
      .filter((key) => Boolean(includeFilters[key]));
  } else {
    const {
      excludedChatIds,
      ...excludeFilters
    } = selectTemp
      ? state.excludeFilters || {}
      : pick(
        state.folder,
        EXCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = excludedChatIds || [];
    selectedChatTypes = (Object.keys(excludeFilters) as Array<keyof typeof excludeFilters>)
      .filter((key) => Boolean(excludeFilters[key]));
  }

  const global = getGlobal();
  const existingSelectedChatIds = selectedChatIds.filter((id) => selectChat(global, id));

  return {
    selectedChatIds: existingSelectedChatIds,
    selectedChatTypes,
  };
}

function getSuggestedFolderName(includeFilters?: FolderIncludeFilters) {
  if (includeFilters) {
    const {
      includedChatIds,
      ...filters
    } = includeFilters;

    if (
      Object.values(filters).filter(Boolean).length > 1
      || (includedChatIds?.length)
    ) {
      return '';
    }

    if (filters.bots) {
      return 'Bots';
    } else if (filters.groups) {
      return 'Groups';
    } else if (filters.channels) {
      return 'Channels';
    } else if (filters.contacts) {
      return 'Contacts';
    } else if (filters.nonContacts) {
      return 'Non-Contacts';
    }
  }

  return '';
}

type FolderIncludeFilters = Pick<ApiChatFolder, (
  'includedChatIds' | 'bots' | 'channels' | 'groups' | 'contacts' | 'nonContacts'
)>;
type FolderExcludeFilters = Pick<ApiChatFolder, 'excludedChatIds' | 'excludeArchived' | 'excludeMuted' | 'excludeRead'>;

export type FoldersState = {
  mode: 'create' | 'edit';
  isLoading?: boolean;
  isTouched?: boolean;
  error?: string;
  folderId?: number;
  chatFilter: string;
  folder: Omit<ApiChatFolder, 'id' | 'description'> & { 
    customEmoji?: { id: string; emoji: string } | undefined;
  };
  includeFilters?: FolderIncludeFilters;
  excludeFilters?: FolderExcludeFilters;
}
export type FoldersActions = (
  'setTitle' | 'saveFilters' | 'editFolder' | 'reset' | 'setChatFilter' | 'setIsLoading' | 'setError' |
  'editIncludeFilters' | 'editExcludeFilters' | 'setIncludeFilters' | 'setExcludeFilters' | 'setIsTouched' |
  'setFolderId' | 'setIsChatlist' | 'setChatIcon'
);
export type FolderEditDispatch = Dispatch<FoldersState, FoldersActions>;

const INITIAL_STATE: FoldersState = {
  mode: 'create',
  chatFilter: '',
  folder: {
    title: { text: '' },
    includedChatIds: [],
    excludedChatIds: [],
    emoticon: '',
    // customEmoji: '',
  },
};



const foldersReducer: StateReducer<FoldersState, FoldersActions> = (
  state,
  action,
): FoldersState => {
  switch (action.type) {
    case 'setTitle': {
   
      const userText = action.payload;
    
 
      let newEntities = [...(state.folder.title.entities || [])];
      let oldText = state.folder.title.text;
    
  
      const customEmojiIndex = newEntities.findIndex(
        (ent) => ent.type === ApiMessageEntityTypes.CustomEmoji,
      );
      if (customEmojiIndex !== -1) {
        const oldEnt = newEntities[customEmojiIndex];
  
        oldText =
          oldText.slice(0, oldEnt.offset) +
          oldText.slice(oldEnt.offset + oldEnt.length);
        newEntities.splice(customEmojiIndex, 1);
      }
    
     
      let finalText = userText;
    
     
      const { customEmoji } = state.folder;
      if (customEmoji && customEmoji.id && customEmoji.emoji) {
     
        if (userText) {
          finalText += ' ' + customEmoji.emoji; 
          newEntities.push({
            documentId: customEmoji.id,
            type: ApiMessageEntityTypes.CustomEmoji,
            offset: userText.length + 1,
            length: customEmoji.emoji.length,
          });
        } else {
          
          finalText = customEmoji.emoji;
          newEntities.push({
            documentId: customEmoji.id,
            type: ApiMessageEntityTypes.CustomEmoji,
            offset: 0,
            length: customEmoji.emoji.length,
          });
        }
      }
    
      return {
        ...state,
        folder: {
          ...state.folder,
          title: {
            text: finalText,
            entities: newEntities,
          },
        },
        isTouched: true,
      };
    }
    
    case 'setFolderId':
      return {
        ...state,
        folderId: action.payload,
        mode: 'edit',
      };
    case 'editIncludeFilters':
      return {
        ...state,
        includeFilters: pick(
          state.folder,
          INCLUDE_FILTER_FIELDS,
        ),
      };
    case 'editExcludeFilters':
      return {
        ...state,
        excludeFilters: pick(
          state.folder,
          EXCLUDE_FILTER_FIELDS,
        ),
      };
    case 'setIncludeFilters':
      return {
        ...state,
        includeFilters: action.payload,
        chatFilter: '',
      };
    case 'setExcludeFilters':
      return {
        ...state,
        excludeFilters: action.payload,
        chatFilter: '',
      };
    case 'saveFilters':
      if (state.includeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, INCLUDE_FILTER_FIELDS),
            title: state.folder.title ? state.folder.title : { text: getSuggestedFolderName(state.includeFilters) },
            ...state.includeFilters,
          },
          includeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else if (state.excludeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, EXCLUDE_FILTER_FIELDS),
            ...state.excludeFilters,
          },
          excludeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else {
        return state;
      }
    case 'editFolder': {
      const { id: folderId, description, ...folder } = action.payload;

      return {
        mode: 'edit',
        folderId,
        folder,
        chatFilter: '',
      };
    }
    case 'setChatFilter': {
      console.log(action)
      return {
        ...state,
        chatFilter: action.payload,
      };
    }
    case 'setChatIcon': {
      const newEmoji = action.payload.emoji;
      const newDocumentId = action.payload.id;
    
      let oldText = state.folder.title.text;
      let newEntities = [...(state.folder.title.entities || [])];
    
      // Видаляємо попередній кастомний емодзі (якщо є)
      const lastCustomEmojiIndex = newEntities
        .map((e) => e.type)
        .lastIndexOf(ApiMessageEntityTypes.CustomEmoji);
    
      if (lastCustomEmojiIndex !== -1) {
        const ent = newEntities[lastCustomEmojiIndex];
        oldText = oldText.slice(0, ent.offset) + oldText.slice(ent.offset + ent.length);
        newEntities.splice(lastCustomEmojiIndex, 1);
      }
    
      // Замість:
      // const offset = oldText.length ? oldText.length + 1 : 0;
      // const newText = oldText + (oldText ? ' ' : '') + newEmoji;
    
      // Робимо:
      const offset = oldText.length; // зміщення = довжина старого тексту
      const newText = oldText + newEmoji; // додаємо емодзі без пробілу
    
      newEntities.push({
        documentId: newDocumentId,
        type: ApiMessageEntityTypes.CustomEmoji,
        offset,
        length: newEmoji.length,
      });
    
      return {
        ...state,
        folder: {
          ...state.folder,
          title: {
            text: newText,
            entities: newEntities,
          },
          emoticon: newEmoji,
          customEmoji: action.payload || newEmoji,
        },
      };
    }
    case 'setIsTouched': {
      return {
        ...state,
        isTouched: action.payload,
      };
    }
    case 'setIsLoading': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case 'setError': {
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    }
    case 'setIsChatlist':
      return {
        ...state,
        folder: {
          ...state.folder,
          isChatList: action.payload,
        },
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
};

const useFoldersReducer = () => {
  return useReducer(foldersReducer, INITIAL_STATE);
};

export default useFoldersReducer;