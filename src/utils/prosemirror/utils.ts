import { Node, NodeType, ResolvedPos, Mark, MarkType } from 'prosemirror-model'
import { EditorState, Selection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { selectAll } from 'prosemirror-commands'
import { ToMutable } from '@/types/global'

export const autoSelectAll = (view: EditorView) => {
  const { empty } = view.state.selection
  if (empty) selectAll(view.state, view.dispatch)
}

export const addMark = (editorView: EditorView, mark: Mark, selection?: { from: number; to: number; }) => {
  if (selection) {
    editorView.dispatch(editorView.state.tr.addMark(selection.from, selection.to, mark))
  }
  else {
    const { $from, $to } = editorView.state.selection
    editorView.dispatch(editorView.state.tr.addMark($from.pos, $to.pos, mark))
  }
}

export const findNodesWithSameMark = (doc: Node, from: number, to: number, markType: MarkType) => {
  let ii = from
  const finder = (mark: Mark) => mark.type === markType
  let firstMark = null
  let fromNode = null
  let toNode = null

  while (ii <= to) {
    const node = doc.nodeAt(ii)
    if (!node || !node.marks) return null

    const mark = node.marks.find(finder)
    if (!mark) return null

    if (firstMark && mark !== firstMark) return null

    fromNode = fromNode || node
    firstMark = firstMark || mark
    toNode = node
    ii++
  }

  let fromPos = from
  let toPos = to

  let jj = 0
  ii = from - 1
  while (ii > jj) {
    const node = doc.nodeAt(ii)
    const mark = node && node.marks.find(finder)
    if (!mark || mark !== firstMark) break
    fromPos = ii
    fromNode = node
    ii--
  }

  ii = to + 1
  jj = doc.nodeSize - 2
  while (ii < jj) {
    const node = doc.nodeAt(ii)
    const mark = node && node.marks.find(finder)
    if (!mark || mark !== firstMark) break
    toPos = ii
    toNode = node
    ii++
  }

  return {
    mark: firstMark,
    from: {
      node: fromNode,
      pos: fromPos,
    },
    to: {
      node: toNode,
      pos: toPos,
    },
  }
}

const equalNodeType = (nodeType: NodeType, node: Node) => {
  return Array.isArray(nodeType) && nodeType.indexOf(node.type) > -1 || node.type === nodeType
}

const findParentNodeClosestToPos = ($pos: ResolvedPos, predicate: (node: Node) => boolean) => {
  for (let i = $pos.depth; i > 0; i--) {
    const node = $pos.node(i)
    if (predicate(node)) {
      return {
        pos: i > 0 ? $pos.before(i) : 0,
        start: $pos.start(i),
        depth: i,
        node,
      }
    }
  }
}

export const findParentNode = (predicate: (node: Node) => boolean) => {
  return (_ref: Selection) => findParentNodeClosestToPos(_ref.$from, predicate)
}

export const findParentNodeOfType = (nodeType: NodeType) => {
  return (selection: Selection) => {
    return findParentNode((node: Node) => {
      return equalNodeType(nodeType, node)
    })(selection)
  }
}

export const isActiveOfParentNodeType = (nodeType: string, state: EditorState) => {
  const node = state.schema.nodes[nodeType]
  return !!findParentNodeOfType(node)(state.selection)
}

export const getMarkAttrs = (view: EditorView) => {
  const { selection, doc } = view.state
  const { from } = selection

  let node = doc.nodeAt(from) || doc.nodeAt(from - 1)
  if (node?.lastChild) node = node.lastChild

  return (node?.marks || []) as ToMutable<Mark[]>
}

export const getAttrValue = (marks: Mark[], markType: string, attr: string) => {
  for (const mark of marks) {
    if (mark.type.name === markType && mark.attrs[attr]) return mark.attrs[attr]
  }
  return null
}

export const isActiveMark = (marks: Mark[], markType: string) => {
  for (const mark of marks) {
    if (mark.type.name === markType) return true
  }
  return false
}

export const markActive = (state: EditorState, type: MarkType) => {
  const { from, $from, to, empty } = state.selection
  if (empty) return type.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, type)
}

export const getAttrValueInSelection = (view: EditorView, attr: string) => {
  const { selection, doc } = view.state
  const { from, to } = selection

  let keepChecking = true
  let value = ''
  doc.nodesBetween(from, to, node => {
    if (keepChecking && node.attrs[attr]) {
      keepChecking = false
      value = node.attrs[attr]
    }
    return keepChecking
  })
  return value
}

interface DefaultAttrs {
  color?: string
  backcolor?: string
  fontsize?: string
  fontname?: string
  align?: string
}
const _defaultAttrs: DefaultAttrs = {
  color: '#000',
  backcolor: '#000',
  fontsize: '20px',
  fontname: '微软雅黑',
  align: 'left',
}
export const getTextAttrs = (view: EditorView, defaultAttrs: DefaultAttrs = {}) => {
  defaultAttrs = { ..._defaultAttrs, ...defaultAttrs }

  const marks = getMarkAttrs(view)

  const isBold = isActiveMark(marks, 'strong')
  const isEm = isActiveMark(marks, 'em')
  const isUnderline = isActiveMark(marks, 'underline')
  const isStrikethrough = isActiveMark(marks, 'strikethrough')
  const isSuperscript = isActiveMark(marks, 'superscript')
  const isSubscript = isActiveMark(marks, 'subscript')
  const isCode = isActiveMark(marks, 'code')
  const color = getAttrValue(marks, 'forecolor', 'color') || defaultAttrs.color
  const backcolor = getAttrValue(marks, 'backcolor', 'backcolor') || defaultAttrs.backcolor
  const fontsize = getAttrValue(marks, 'fontsize', 'fontsize') || defaultAttrs.fontsize
  const fontname = getAttrValue(marks, 'fontname', 'fontname') || defaultAttrs.fontname
  const link = getAttrValue(marks, 'link', 'href') || ''
  const align = getAttrValueInSelection(view, 'align') || defaultAttrs.align
  const isBulletList = isActiveOfParentNodeType('bullet_list', view.state)
  const isOrderedList = isActiveOfParentNodeType('ordered_list', view.state)
  const isBlockquote = isActiveOfParentNodeType('blockquote', view.state)

  return {
    bold: isBold,
    em: isEm,
    underline: isUnderline,
    strikethrough: isStrikethrough,
    superscript: isSuperscript,
    subscript: isSubscript,
    code: isCode,
    color: color,
    backcolor: backcolor,
    fontsize: fontsize,
    fontname: fontname,
    link: link,
    align: align,
    bulletList: isBulletList,
    orderedList: isOrderedList,
    blockquote: isBlockquote,
  }
}

export type TextAttrs = ReturnType<typeof getTextAttrs>

export const getFontsize = (view: EditorView) => {
  const marks = getMarkAttrs(view)
  const fontsize = getAttrValue(marks, 'fontsize', 'fontsize') || _defaultAttrs.fontsize
  return parseInt(fontsize)
}

export const defaultRichTextAttrs: TextAttrs = {
  bold: false,
  em: false,
  underline: false,
  strikethrough: false,
  superscript: false,
  subscript: false,
  code: false,
  color: '#000',
  backcolor: '#000',
  fontsize: '20px',
  fontname: '微软雅黑',
  link: '',
  align: 'left',
  bulletList: false,
  orderedList: false,
  blockquote: false,
}