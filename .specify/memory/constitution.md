<!--
SYNC IMPACT REPORT
==================
Version change: N/A (initial) → 1.0.0
Added sections:
  - Core Principles (4 principles)
  - Performance Standards
  - Quality Gates
  - Governance
Removed sections: None (initial constitution)
Templates requiring updates:
  ✅ .specify/templates/plan-template.md - Constitution Check section present
  ✅ .specify/templates/spec-template.md - Success criteria section aligns
  ✅ .specify/templates/tasks-template.md - Test-first pattern supported
Follow-up TODOs: None
-->

# AI SDK Agent Constitution

## Core Principles

### I. Code Quality

All code MUST adhere to strict quality standards to ensure maintainability, readability, and reliability.

- **Type Safety**: TypeScript strict mode MUST be enabled; `any` types are prohibited except in explicitly justified edge cases
- **Naming Conventions**: Variables, functions, and classes MUST use descriptive names that convey intent; abbreviations are prohibited except for well-known acronyms (e.g., API, HTTP, URL)
- **Single Responsibility**: Each module, class, and function MUST have one clearly defined purpose; files exceeding 300 lines MUST be evaluated for decomposition
- **Dependency Management**: All dependencies MUST be explicitly declared with pinned versions; unused dependencies MUST be removed; security vulnerabilities MUST be addressed within 48 hours of disclosure
- **Error Handling**: All async operations MUST have explicit error handling; errors MUST be typed and provide actionable context; silent failures are prohibited
- **Documentation**: Public APIs MUST have JSDoc comments; complex logic MUST include inline comments explaining the "why"; README files MUST be kept current with actual behavior

**Rationale**: Consistent code quality reduces cognitive load during code review, accelerates onboarding, and prevents defect accumulation over time.

### II. Testing Standards

Testing MUST be comprehensive, automated, and integrated into the development workflow.

- **Test-First Development**: For non-trivial changes, tests MUST be written before implementation; tests MUST fail initially to validate test correctness
- **Coverage Requirements**: Unit test coverage MUST meet or exceed 80% for business logic; critical paths (authentication, data persistence, API contracts) MUST have 100% coverage
- **Test Categories**:
  - **Unit Tests**: MUST test individual functions/methods in isolation with mocked dependencies
  - **Integration Tests**: MUST verify component interactions and external service integrations
  - **Contract Tests**: MUST validate API request/response schemas match specifications
- **Test Quality**: Tests MUST be deterministic (no flaky tests); tests MUST complete within 10 seconds individually; test names MUST describe the scenario and expected outcome
- **Continuous Integration**: All tests MUST pass before merge; test failures MUST block deployment

**Rationale**: Comprehensive testing provides confidence in refactoring, catches regressions early, and serves as executable documentation of expected behavior.

### III. User Experience Consistency

All user-facing interfaces MUST provide predictable, intuitive, and responsive interactions.

- **Response Format**: All agent responses MUST follow consistent formatting patterns; structured data MUST use JSON; human-readable output MUST be clear and actionable
- **Error Messages**: User-facing errors MUST explain what went wrong, why, and how to resolve it; internal errors MUST NOT leak implementation details
- **Progress Indication**: Long-running operations (>2 seconds) MUST provide progress feedback; operations MUST support cancellation where technically feasible
- **Accessibility**: CLI interfaces MUST support standard input/output patterns; output MUST be parseable by common tools (grep, jq, pipes)
- **Backward Compatibility**: Breaking changes to public interfaces MUST be documented with migration guides; deprecation MUST precede removal by at least one minor version

**Rationale**: Consistent UX builds user trust, reduces support burden, and enables automation through predictable behavior.

### IV. Performance Requirements

The system MUST meet defined performance thresholds to ensure responsiveness and scalability.

- **Response Time Targets**:
  - Simple queries: <500ms p95 latency
  - Complex operations with planning: <5s p95 latency
  - Tool executions: dependent on external services, but orchestration overhead MUST be <100ms
- **Resource Efficiency**:
  - Memory usage MUST remain stable during extended sessions (no memory leaks)
  - Context management MUST efficiently compact conversation history to stay within token limits
  - Parallel operations MUST be preferred over sequential when dependencies allow
- **Observability**:
  - All operations MUST emit structured logs with correlation IDs
  - Performance metrics MUST be collected for latency, throughput, and error rates
  - Token usage MUST be tracked per operation for cost monitoring
- **Graceful Degradation**: The system MUST handle rate limits, timeouts, and service outages gracefully with appropriate retries and user feedback

**Rationale**: Measurable performance standards enable optimization efforts, capacity planning, and SLA commitments.

## Performance Standards

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Simple query latency (p95) | <500ms | <1s |
| Planning + execution latency (p95) | <5s | <10s |
| Memory growth per session | <10MB/hour | <50MB/hour |
| Test suite execution | <2 minutes | <5 minutes |
| Build time | <30 seconds | <60 seconds |

## Quality Gates

All changes MUST pass these gates before merge:

1. **Lint Check**: Zero ESLint errors; zero TypeScript errors in strict mode
2. **Test Suite**: All tests pass; coverage thresholds met
3. **Build Verification**: Production build completes without warnings
4. **Performance Baseline**: No regression in benchmark tests exceeding 10%
5. **Security Scan**: No high/critical vulnerabilities in dependencies

## Governance

This constitution supersedes all other development practices. Amendments require:

1. **Documentation**: Written proposal describing the change and rationale
2. **Review**: Approval from project maintainers
3. **Migration Plan**: For breaking changes, a plan for updating existing code
4. **Version Update**: Constitution version MUST be incremented according to semantic versioning

**Versioning Policy**:
- MAJOR: Principle removal or redefinition that changes compliance requirements
- MINOR: New principle or section added
- PATCH: Clarification, wording improvement, or threshold adjustment

**Compliance Review**: All pull requests MUST verify adherence to these principles. Reviewers MUST cite specific principle violations when requesting changes.

**Version**: 1.0.0 | **Ratified**: 2025-12-30 | **Last Amended**: 2025-12-30
