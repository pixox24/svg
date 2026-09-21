import {EditorView} from '@codemirror/view';

const ivory = '#eeeae3';
const ink = '#12141a';

export default EditorView.theme({
  "&": {
    color: ivory,
    backgroundColor: ink,
  },
  ".ͼi": {
    color: '#c9a46c',
  },
  ".ͼd": {
    color: '#e8d5a3',
  },
  ".ͼc": {
    color: '#9bb7d4',
  },
  ".ͼb": {
    color: '#d4a0b0',
  },
  ".ͼm": {
    color: '#6a6762',
  },
  ".ͼj": {
    color: '#9bb7d4',
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: '#c9a46c'
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: '#2a261f',
  },
  ".cm-selectionBackground": {
    backgroundColor: '#2a261f',
  },
  ".cm-gutters": {
    backgroundColor: ink,
    color: '#5e5b56',
    border: "none"
  },
  ".cm-activeLine": {
    backgroundColor: '#1a1d24',
  },
  ".cm-activeLineGutter": {
    color: ivory,
    backgroundColor: '#1a1d24',
  }
}, {dark: true});

