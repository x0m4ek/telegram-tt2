import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { selectIsContextMenuTranslucent } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';

import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';

import styles from './FolderPickerMenu.module.scss';
import useLastCallback from '../../../hooks/useLastCallback';
import { IAnchorPosition } from '../../../types';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import { getIsMobile } from '../../../hooks/useAppLayout';
import { REM } from '../../common/helpers/mediaDimensions';
import buildClassName from '../../../util/buildClassName';
import EmojiPicker from '../../middle/composer/EmojiPicker';

export type OwnProps = {
  isOpen: boolean;
  buttonRef: RefObject<HTMLButtonElement>;
  onEmojiStatusSelect: (emojiStatus: ApiSticker) => void;
  onClose: () => void;
  handleContextMenuHide: () => void;
  contextMenuAnchor?:IAnchorPosition;
  position?:IAnchorPosition
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

const FolderPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  buttonRef,
  areFeaturedStickersLoaded,
  isTranslucent,
  onEmojiStatusSelect,
  onClose,
  contextMenuAnchor,
  handleContextMenuHide,
  position,
}) => {
  const { loadFeaturedEmojiStickers } = getActions();
  const FULL_PICKER_SHIFT_DELTA = { x: -23, y: -64 };
  const LIMITED_PICKER_SHIFT_DELTA = { x: -21, y: -10 };
  const REACTION_SELECTOR_WIDTH = 16.375 * REM;
  const transformOriginX = useRef<number>();
  const [isContextMenuShown, markContextMenuShown, unmarkContextMenuShown] = useFlag();
  const contextRootElementSelector="#LeftColumn"
//   const getTriggerElement = useLastCallback(() => buttonRef.current);
//   const getRootElement = useLastCallback(
//     () => (contextRootElementSelector ? buttonRef.current!.closest(contextRootElementSelector) : document.body),
//   );
//   const getMenuElement = useLastCallback(
//     () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
//   );
//   const getLayout = useLastCallback(() => ({ withPortal: true }));
 const shouldUseFullPicker = true;
  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  const handleEmojiSelect = useCallback((sticker: string, name:string) => {
    onEmojiStatusSelect(sticker);
    onClose();
  }, [onClose, onEmojiStatusSelect]);

  const storedPosition = useCurrentOrPrev(position, true);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const renderingPosition = useMemo((): IAnchorPosition | undefined => {
    if (!storedPosition) {
      return undefined;
    }

    // if (renderedStoryId) {
    //   return storedPosition;
    // }

    return {
      x: storedPosition.x + (shouldUseFullPicker ? FULL_PICKER_SHIFT_DELTA.x : LIMITED_PICKER_SHIFT_DELTA.x),
      y: storedPosition.y + (shouldUseFullPicker ? FULL_PICKER_SHIFT_DELTA.y : LIMITED_PICKER_SHIFT_DELTA.y),
    };
  }, [ storedPosition, shouldUseFullPicker]);

  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({
    withPortal: true,
    isDense: false,
    deltaX: !getIsMobile() && menuRef.current
      ? -(menuRef.current.offsetWidth - REACTION_SELECTOR_WIDTH) / 2 - FULL_PICKER_SHIFT_DELTA.x / 2
      : 0,
  }));
  function getTriggerElement(): HTMLElement | null {
    return document.querySelector('body');
  }
  
  function getRootElement() {
    return document.querySelector('body');
  }
  
  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        ref={menuRef}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
        className={buildClassName(styles.menu, 'ReactionPicker')}
        anchor={renderingPosition}
        onClose={onClose}
        onCloseAnimationEnd={handleContextMenuHide}
        withPortal
        noCompact
        positionX="right"
        bubbleClassName={styles.menuContent}
      >
        <CustomEmojiPicker
          idPrefix="status-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          // це фіксить переключатель але треба інший спосіб знайти бо це додає деякі непотрібні смайлики дефолтні
          withDefaultTopicIcons={true}
          // isStatusPicker
          isTranslucent={isTranslucent}
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onCustomEmojiSelect={handleEmojiSelect}
          onContextMenuClick={onClose}
        />
        {/* <EmojiPicker
             idPrefix="status-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          // це фіксить переключатель але треба інший спосіб знайти бо це додає деякі непотрібні смайлики дефолтні
          withDefaultTopicIcons={true}
          // isStatusPicker
          isTranslucent={isTranslucent}
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onCustomEmojiSelect={handleEmojiSelect}
          onContextMenuClick={onClose}

          onEmojiSelect={handleEmojiSelect}
        /> */}
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
    isTranslucent: selectIsContextMenuTranslucent(global),
  };
})(FolderPickerMenu));
