import {EditorView} from '@codemirror/view';

const ivory = '#f4f4f5';
const ink = '#121214';

export default EditorView.theme({
  "&": {
    color: ivory,
    backgroundColor: ink,
  },
  ".ͼi": {
    color: '#9982f8',
  },
  ".ͼd": {
    color: '#c4b5fd',
  },
  ".ͼc": {
    color: '#9bb7d4',
  },
  ".ͼb": {
    color: '#d4a0b0',
  },
  ".ͼm": {
    color: '#71717a',
  },
  ".ͼj": {
    color: '#9bb7d4',
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: '#9982f8'
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: 'rgba(153, 130, 248, 0.28)',
  },
  ".cm-selectionBackground": {
    backgroundColor: 'rgba(153, 130, 248, 0.28)',
  },
  ".cm-gutters": {
    backgroundColor: ink,
    color: '#71717a',
    border: "none"
  },
  ".cm-activeLine": {
    backgroundColor: '#1c1c20',
  },
  ".cm-activeLineGutter": {
    color: ivory,
    backgroundColor: '#1c1c20',
  }
}, {dark: true});

