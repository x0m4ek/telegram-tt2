type CaretPosition = {
    offset: number;
    nodeIndex: number; 
    nodeOffset: number; 
};
  
  
  export class UndoManager {
    private stack: Array<{ html: string; caretPosition: CaretPosition }> = [];
    private currentIndex: number = -1;
    private maxSize: number = 100;
  
    constructor(maxSize = 100) {
      this.maxSize = maxSize;
    }
  
    push(state: string, caretPosition: CaretPosition): void {
      if (this.currentIndex >= 0 && 
          this.stack[this.currentIndex].html === state) {
        return;
      }
  
      this.stack = this.stack.slice(0, this.currentIndex + 1);
      
      this.stack.push({ html: state, caretPosition });
      
      if (this.stack.length > this.maxSize) {
        this.stack.shift();
      }
      
      this.currentIndex = this.stack.length - 1;
    }
  
    undo(): { html: string; caretPosition: CaretPosition } | undefined {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        return this.stack[this.currentIndex];
      }
      return undefined;
    }
  
    redo(): { html: string; caretPosition: CaretPosition } | undefined {
      if (this.currentIndex < this.stack.length - 1) {
        this.currentIndex++;
        return this.stack[this.currentIndex];
      }
      return undefined;
    }
  
    clear(): void {
      this.stack = [];
      this.currentIndex = -1;
    }
  }
  
 
function isElementNode(node: Node): node is HTMLElement {
    return node.nodeType === Node.ELEMENT_NODE;
  }
  
  function isEmojiElement(node: Node): boolean {
    if (!isElementNode(node)) return false;
    
    if (node.nodeName === 'IMG') return true;
    
    if (node.nodeName === 'SPAN') {
      // Cross-browser way to check for classList
      return !!(
        'classList' in node && 
        node.classList && 
        node.classList.contains('emoji')
      );
    }
    
    return false;
  }
  
  // Cross-browser TreeWalker filter
  const nodeFilter: NodeFilter = {
    acceptNode(node: Node): number {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (isElementNode(node) && (node.nodeName === 'IMG' || node.nodeName === 'SPAN')) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  };
  
  export function saveCaretPosition(element: HTMLElement): CaretPosition {
    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return { offset: 0, nodeIndex: 0, nodeOffset: 0 };
      }
  
      const range = selection.getRangeAt(0);
      
      if (!element.contains(range.startContainer)) {
        return { offset: 0, nodeIndex: 0, nodeOffset: 0 };
      }
  
      let offset = 0;
      let nodeIndex = 0;
  
      // Use try-catch for older browsers that might not support TreeWalker
      let walker: TreeWalker;
      try {
        walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          nodeFilter
        );
      } catch (e) {
        // Fallback for older browsers
        walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
        );
      }
  
      let currentNode: Node | null = walker.nextNode();
      
      while (currentNode) {
        if (currentNode === range.startContainer) {
          break;
        }
  
        if (currentNode.nodeType === Node.TEXT_NODE) {
          offset += currentNode.textContent?.length || 0;
        } else if (isEmojiElement(currentNode)) {
          offset += 1;
        }
        
        nodeIndex++;
        currentNode = walker.nextNode();
      }
  
      return {
        offset: offset + (range.startOffset || 0),
        nodeIndex,
        nodeOffset: range.startOffset || 0
      };
    } catch (error) {
      console.error('Failed to save caret position:', error);
      return { offset: 0, nodeIndex: 0, nodeOffset: 0 };
    }
  }
  
  export function restoreCaretPosition(element: HTMLElement, position: CaretPosition): void {
    if (!position) return;
  
    const selection = window.getSelection();
    if (!selection) return;
  
    try {
      const range = document.createRange();
      let currentOffset = 0;
      let targetNode: Node | null = null;
      let targetOffset = 0;
  
      // Use try-catch for older browsers
      let walker: TreeWalker;
      try {
        walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          nodeFilter
        );
      } catch (e) {
        // Fallback for older browsers
        walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
        );
      }
  
      let node: Node | null = walker.nextNode();
      
      while (node) {
        let nodeLength = 0;
        
        if (node.nodeType === Node.TEXT_NODE) {
          nodeLength = node.textContent?.length || 0;
        } else if (isEmojiElement(node)) {
          nodeLength = 1;
        }
  
        if (currentOffset + nodeLength >= position.offset) {
          targetNode = node;
          targetOffset = position.offset - currentOffset;
          break;
        }
  
        currentOffset += nodeLength;
        node = walker.nextNode();
      }
  
      if (targetNode) {
        if (isElementNode(targetNode)) {
          const parent = targetNode.parentNode;
          if (parent) {
            // Cross-browser way to get child index
            let index = 0;
            let child = parent.firstChild;
            while (child && child !== targetNode) {
              index++;
              child = child.nextSibling;
            }
            range.setStart(parent, index + (targetOffset > 0 ? 1 : 0));
          }
        } else {
          range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0));
        }
        
        range.collapse(true);
  
   
        try {
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Fallback for older IE
          const doc = element.ownerDocument;
          if (doc && 'selection' in doc) {
            const ieRange = (doc as any).selection.createRange();
            ieRange.moveToElementText(element);
            ieRange.collapse(true);
            ieRange.moveEnd('character', position.offset);
            ieRange.moveStart('character', position.offset);
            ieRange.select();
          }
        }
      } else if (element.lastChild) {
    
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      console.error('Failed to restore caret position:', error);
    }
  }