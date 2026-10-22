# Spec Delta

## Purpose

使整体迁移的每项旧入口、批准差异、实施任务与验收证据有清晰关联，不把局部样式、组件存在或旧测试实例成功误认为当前所有业务闭环。规格与任务是工作记录，运行结论仍由唯一32180的真实回执和文件读取证明。

## ADDED Requirements

### Requirement: Evidence distinctions
系统交付记录 SHALL 将34项审计的代码对应、批准差异、隔离测试、当前真实验收和未完成边界分开记录。

#### Scenario: Fixture test passes
- **WHEN** 测试仅使用模拟传输或渲染夹具
- **THEN** 只标隔离通过，不能标当前32180真实业务通过

### Requirement: Single backend UI acceptance
真实Creator验收 MUST 从唯一32180现有后台UI发起，并核对既有e2e工程及已生成文件的身份。

#### Scenario: Existing image import
- **WHEN** 测试工程已确认且已有生成物可由现有受控入口采用
- **THEN** 从后台打开、导入并只读核对PNG/meta/UUID，不额外生成或另建后台

#### Scenario: Runtime prerequisite missing
- **WHEN** 素材来源绑定、服务或认证前置缺失
- **THEN** 明确记录确切阻塞及必要动作，不绕UI、不伪造任务或跨库复制凭据
