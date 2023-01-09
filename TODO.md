# TODOs

## Overall

- [ ] Rethink about config options  
(Currently, many options originated from yatt\_lite have the same names as their originals to reduce errors of code porting)

## Core Codegen Layer

- [ ] xhf tests

- sourcemap support
   - [x] underlying logic
   - [ ] tests
   - [ ] adaptor support?(where to save the sourcemap?)
- more builtin macros
   - [ ] extensible `yatt:foreach`
   - [ ] `yatt:if`
   - [ ] `yatt:my`
- [ ] default values
- [ ] ts-native types
- [ ] generate without types?

- [ ] `&yatt:render(widget);` with interface/type

## For Generic Web App Support

- [ ] Platform neutral yatt runtime?

   - [ ] `app.render()`, `app.do()`??

      - [ ] Throw/Catch special response

      - [ ] Sigil mappings for pages and actions

      - [ ] Inline route for yatt:page decls

- [ ] Platform neutral directory organization for entities, pages, widgets and components?

## For Node

- [ ] router generator

