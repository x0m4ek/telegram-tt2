import type {
  ChangeEvent, FormEvent, RefObject,
} from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';
import Icon from '../common/icons/Icon';
import { ApiEmojiStatus, ApiSticker } from '../../api/types';
import CustomEmoji from '../common/CustomEmoji';
import { emojiToIconMap } from './Folder';

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  id?: string;
  className?: string;
  value?: string;
  label?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  withEmojiPicker?: boolean;
  isCustomEmoji?:boolean,
  customEmoji?:ApiSticker | string 
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  tabIndex?: number;
  buttonRef?: RefObject<HTMLDivElement>;
  teactExperimentControlled?: boolean;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onEmojiClick?: (e: React.MouseEvent) => void;
};

const InputText: FC<OwnProps> = ({
  ref,
  id,
  className,
  value,
  customEmoji,
  isCustomEmoji,
  label,
  error,
  success,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  tabIndex,
  teactExperimentControlled,
  onChange,
  onInput,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
  withEmojiPicker,
  onEmojiClick,
  buttonRef,
}) => {
  const lang = useOldLang();
  const labelText = error || success || label;
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    withEmojiPicker && 'with-picker',
    labelText && 'with-label',
    className,
  );
  function isApiSticker(value: string | ApiSticker): value is ApiSticker {
    return typeof value !== 'string';
  }
  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        ref={ref}
        className="form-control"
        type="text"
        id={id}
        dir="auto"
        value={value || ''}
        tabIndex={tabIndex}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onInput={onInput}
        onKeyPress={onKeyPress}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-label={labelText}
        teactExperimentControlled={teactExperimentControlled}
      />
      {labelText && (
        <label htmlFor={id}>{labelText}</label>
      )}

{withEmojiPicker && (
  <div className="picker-icon" onClick={onEmojiClick}>
    {isCustomEmoji && isApiSticker(customEmoji!) ? (
      <CustomEmoji
        size={32}
        key={customEmoji.id}
        documentId={customEmoji.id}
        ref={buttonRef}
      />
    ) : (
      <Icon
        name={emojiToIconMap[customEmoji as string] || 'chat'}
        onClick={onEmojiClick}
        ref={buttonRef}
      />
    )}
  </div>
)}
</div>
  );
};

export default memo(InputText);
