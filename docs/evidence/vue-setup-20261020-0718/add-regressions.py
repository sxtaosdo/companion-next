from pathlib import Path
R=Path('D:/code/shidai3/P8000/companion-next')
p=R/'tests/project-setup-ui.test.ts';raw=p.read_bytes()
anchor=b" it('never submits by connecting, opening or closing; all effects start unchecked'"
assert raw.count(anchor)==1
tests=''' it('binds the registration path to the explicit project card instead of a cancelled other-project draft',async()=>{
  const {api}=await setup()
  await click('添加已有工程')
  await body().get('input[aria-label="已有工程绝对路径"]').setValue('D:\\\\Other\\\\CancelledDraft')
  await click('关闭向导')
  await openFull()
  expect(body().get('input[aria-label="已有工程绝对路径"]').element).toHaveProperty('value',path)
  const wizard=wrapper!.findComponent({name:'ProjectSetupWizard'})
  expect(wizard.findComponent({name:'ElSelect'}).props('modelValue')).toBe(id)
  for(const input of body().findAll('.setup-consents input'))expect((input.element as HTMLInputElement).checked).toBe(false)
  expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(api.status).not.toHaveBeenCalled()
 })
 it('does not open a project-card setup for an ID absent from the current registration snapshot',async()=>{
  const {api}=await setup()
  const wizard=wrapper!.findComponent({name:'ProjectSetupWizard'})
  ;(wizard.vm as unknown as {openForProject(id:string):void}).openForProject('fedcba9876543210')
  await flushPromises()
  expect(body().find('input[aria-label="已有工程绝对路径"]').exists()).toBe(false)
  expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(api.status).not.toHaveBeenCalled()
 })
'''.encode('utf-8')
p.write_bytes(raw.replace(anchor,tests+anchor))
print('Added two isolated UI regressions; production untouched')
