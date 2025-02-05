import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { ensureProtocol } from '../../../util/ensureProtocol';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import stopEvent from '../../../util/stopEvent';
import { INPUT_CUSTOM_EMOJI_SELECTOR } from './helpers/customEmoji';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './TextFormatter.scss';

export type OwnProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void;
  onClose: () => void;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  quote?: boolean;
}
interface IFormatAnalysis {
  formats: ISelectedTextFormats;
  hasNestedFormats: boolean;
  hasConflictingFormats: boolean;
}
const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  CODE: 'monospace',
  SPAN: 'spoiler',
  BLOCKQUOTE: 'quote'
  
};
const CONFLICTING_FORMATS = ['monospace', 'strikethrough'];
const fragmentEl = document.createElement('div');

function analyzeFormatting(element: HTMLElement | null): IFormatAnalysis {
  const formats: ISelectedTextFormats = {};
  let hasNestedFormats = false;
  let hasConflictingFormats = false;

  
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    
    
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement!;
    }

    
    let currentElement: HTMLElement | null = container as HTMLElement;
    while (currentElement && currentElement.id !== EDITABLE_INPUT_ID) {
      const tagName = currentElement.tagName.toUpperCase();
      
      const format = TEXT_FORMAT_BY_TAG_NAME[tagName];
      
      if (format) {
        formats[format] = true;
      }
      
  
      if (tagName === 'SPAN' && currentElement.classList.contains('spoiler')) {
        formats.spoiler = true;
      }

      currentElement = currentElement.parentElement;
    }

   
    const fragment = range.cloneContents();
    const formatElements = Array.from(fragment.querySelectorAll('b,strong,i,em,u,del,code,span.spoiler,blockquote'));
    

    formatElements.forEach((el) => {
      const tagName = el.tagName.toUpperCase();
      const format = TEXT_FORMAT_BY_TAG_NAME[tagName];
      
      if (format) {
        formats[format] = true;
      }
      
      if (tagName === 'SPAN' && el.classList.contains('spoiler')) {
        formats.spoiler = true;
      }
    });

    // Check for nested formats
    hasNestedFormats = formatElements.length > 1 || Object.keys(formats).length > 1;

    // Check for conflicting formats
    hasConflictingFormats = CONFLICTING_FORMATS.some((format) => 
      formats[format as keyof ISelectedTextFormats] && Object.keys(formats).length > 1
    );
  }

  // console.log("Selection range:", selection?.getRangeAt(0));
  // console.log("Formats found:", formats);
  // console.log("Has nested formats:", hasNestedFormats);
  // console.log("Has conflicting formats:", hasConflictingFormats);

  return {
    formats,
    hasNestedFormats,
    hasConflictingFormats,
  };
}
const TextFormatter: FC<OwnProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  setSelectedRange,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});
  const [formatAnalysis, setFormatAnalysis] = useState<IFormatAnalysis>({
    formats: {},
    hasNestedFormats: false,
    hasConflictingFormats: false,
  });
  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const parentElement = selectedRange.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? selectedRange.commonAncestorContainer.parentElement
      : selectedRange.commonAncestorContainer as HTMLElement;

    const analysis = analyzeFormatting(parentElement);
    setFormatAnalysis(analysis);
    setSelectedTextFormats(analysis.formats);
  }, [isOpen, selectedRange]);

  const setAndPreserveSelection = useLastCallback((range: Range) => {
    setSelectedRange(range);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
  
  const applyFormatPreservingOthers = useLastCallback((
    command: string, 
    tag?: string,
  ) => {
    if (!selectedRange) return;
  
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
  
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
  
    const analysis = analyzeFormatting(range.commonAncestorContainer as HTMLElement);
    const isFormatActive = analysis.formats[command as keyof ISelectedTextFormats];

   
    const createFormattedHtml = (text: string): string => {
      switch (command) {
        case 'monospace':
          return `<code class="text-entity-code" data-entity-type="${ApiMessageEntityTypes.Code}" dir="auto">${text}</code>`;
        case 'strikethrough':
          return `<del data-entity-type="${ApiMessageEntityTypes.Strike}">${text}</del>`;
        case 'spoiler':
          return `<span class="spoiler" data-entity-type="${ApiMessageEntityTypes.Spoiler}">${text}</span>`;
        case 'quote':
          return `<blockquote data-entity-type="${ApiMessageEntityTypes.Blockquote}">${text}</blockquote>`;
        default:
          return text;
      }
    };
  
    if (['monospace', 'strikethrough', 'spoiler', 'quote'].includes(command)) {
      if (isFormatActive && tag) {
        let element = range.commonAncestorContainer as HTMLElement;
        if (element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement!;
        }
        
        while (element && element.tagName !== tag.toUpperCase()) {
          element = element.parentElement!;
        }
  
        if (!element || !element.textContent) {
          return;
        }

   
        const elementRange = document.createRange();
        elementRange.selectNodeContents(element);
        
        const isPartialSelection = (
          range.startContainer !== elementRange.startContainer ||
          range.endContainer !== elementRange.endContainer ||
          range.startOffset !== elementRange.startOffset ||
          range.endOffset !== elementRange.endOffset
        );

        if (isPartialSelection) {
       
          const parentElement = element.parentElement;
          
          const beforeText = element.textContent.slice(0, range.startOffset);
          const selectedText = range.toString();
          const afterText = element.textContent.slice(range.endOffset);

    
          let newHtml = '';
          if (beforeText) {
            newHtml += createFormattedHtml(beforeText);
          }
          newHtml += selectedText;
          if (afterText) {
            newHtml += createFormattedHtml(afterText);
          }

        
          element.insertAdjacentHTML('beforebegin', newHtml);
          element.remove();

          // REstores selection
          if (parentElement) {
            const newRange = document.createRange();
            const textNodes = Array.from(parentElement.childNodes);
            const selectedNode = textNodes.find(node => 
              node.nodeType === Node.TEXT_NODE && node.textContent === selectedText
            );

            if (selectedNode) {
              newRange.selectNodeContents(selectedNode);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
        } else {

          // If selected whole element then delete all formating text
          const textContent = element.textContent;
          const textNode = document.createTextNode(textContent);
          element.replaceWith(textNode);

          const newRange = document.createRange();
          newRange.setStart(textNode, 0);
          newRange.setEnd(textNode, textContent.length);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
  
        setFormatAnalysis((prevAnalysis) => ({
          ...prevAnalysis,
          formats: {
            ...prevAnalysis.formats,
            [command]: false
          }
        }));
      } else {
        
        const text = range.toString();
        const htmlToInsert = createFormattedHtml(text);
  
        
        document.execCommand('insertHTML', false, htmlToInsert);

      
        const newSelection = window.getSelection();
        if (newSelection && newSelection.rangeCount > 0) {
          const newRange = newSelection.getRangeAt(0);
          let insertedElement = newRange.commonAncestorContainer as HTMLElement;
          if (insertedElement.nodeType === Node.TEXT_NODE) {
            insertedElement = insertedElement.parentElement!;
          }

          const elementRange = document.createRange();
          elementRange.selectNodeContents(insertedElement);
          selection.removeAllRanges();
          selection.addRange(elementRange);
        }
      }
      
      const newSelection = window.getSelection();
      if (newSelection && newSelection.rangeCount > 0) {
        const newRange = newSelection.getRangeAt(0);
        const newAnalysis = analyzeFormatting(newRange.commonAncestorContainer as HTMLElement);
        setFormatAnalysis(newAnalysis);
      }
    } 
    // Simple formats logic
    else {
      
      if (isFormatActive && tag) {
        document.execCommand('removeFormat');
        
        Object.entries(analysis.formats).forEach(([format, isActive]) => {
          if (isActive && format !== command) {
            switch(format) {
              case 'bold':
                document.execCommand('bold');
                break;
              case 'italic':
                document.execCommand('italic');
                break;
              case 'underline':
                document.execCommand('underline');
                break;
            }
          }
        });
      } else {
        switch(command) {
          case 'bold':
            document.execCommand('bold');
            break;
          case 'italic':
            document.execCommand('italic');
            break;
          case 'underline':
            document.execCommand('underline');
            break;
        }
      }
  
      const newAnalysis = analyzeFormatting(range.commonAncestorContainer as HTMLElement);
      setFormatAnalysis(newAnalysis);
    }
  });
  const restoreSelection = useLastCallback(() => {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  });

  const getSelectedText = useLastCallback((shouldDropCustomEmoji?: boolean) => {
    if (!selectedRange) {
      return undefined;
    }
    fragmentEl.replaceChildren(selectedRange.cloneContents());
    if (shouldDropCustomEmoji) {
      fragmentEl.querySelectorAll(INPUT_CUSTOM_EMOJI_SELECTOR).forEach((el) => {
        el.replaceWith(el.getAttribute('alt')!);
      });
    }
    return fragmentEl.innerHTML;
  });

  const getSelectedElement = useLastCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    return selectedRange.commonAncestorContainer.parentElement;
  });

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
   
    if (formatAnalysis.formats[key]) {
      return 'active';
    }
  
    
    if (CONFLICTING_FORMATS.includes(key)) {
      const hasConflictingFormat = CONFLICTING_FORMATS.some(
        (format) => format !== key && formatAnalysis.formats[format as keyof ISelectedTextFormats]
      );
      if (hasConflictingFormat) {
        return 'disabled';
      }
    }
  
    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    applyFormatPreservingOthers('spoiler', 'span');

  });

  const handleBoldText = useLastCallback(() => {
    applyFormatPreservingOthers('bold', 'b');
  });
  
  const handleItalicText = useLastCallback(() => {
    applyFormatPreservingOthers('italic', 'i');

  });

  const handleUnderlineText = useLastCallback(() => {
    applyFormatPreservingOthers('underline', 'u');

  });

  const handleStrikethroughText = useLastCallback(() => {
    applyFormatPreservingOthers('strikethrough', 'del');
  });

  const handleMonospaceText = useLastCallback(() => {
    applyFormatPreservingOthers('monospace', 'code');
  });

  const handleQuoteText = useLastCallback(() => {
    applyFormatPreservingOthers('quote', 'blockquote');
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = getSelectedText(true);
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    Boolean(linkUrl.length) && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-closed" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Quote text"
          className={getFormatButtonClassName('quote')}
          onClick={handleQuoteText}
        >
          <Icon name="quote-text" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <Icon name="link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
