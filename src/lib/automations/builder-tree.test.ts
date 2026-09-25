import { describe, expect, it } from "vitest"
import {
  childPath,
  insertAt,
  mapAtPath,
  moveAt,
  removeAt,
  type StepPath,
} from "./builder-tree"

interface TestStep {
  cid: string
  step_type: string
  step_config: Record<string, unknown>
  branches?: { yes: TestStep[]; no: TestStep[] }
}

function step(cid: string, step_type = "send_message"): TestStep {
  return { cid, step_type, step_config: {}, branches: undefined }
}

function cond(cid: string, yes: TestStep[] = [], no: TestStep[] = []): TestStep {
  return { cid, step_type: "condition", step_config: {}, branches: { yes, no } }
}

describe("childPath", () => {
  it("addresses root steps with a single root marker", () => {
    expect(childPath([], { kind: "root" }, 2)).toEqual([{ kind: "root", index: 2 }])
  })

  it("addresses branch children relative to the owning condition", () => {
    const condPath: StepPath = [{ kind: "root", index: 0 }]
    const path = childPath(
      condPath,
      { kind: "branch", parentCid: "c1", branch: "yes" },
      1,
    )
    // Exactly one marker per level — the second-child marker must not
    // double up on the branch marker (issue #474).
    expect(path).toEqual([
      { kind: "root", index: 0 },
      { kind: "branch", branch: "yes", index: 1 },
    ])
  })
})

describe("insertAt", () => {
  it("inserts into the root list at the requested index", () => {
    const steps = [step("a"), step("b")]
    const next = insertAt(steps, { kind: "root" }, 1, step("x"))
    expect(next.map((s) => s.cid)).toEqual(["a", "x", "b"])
  })

  it("inserts into a condition branch by cid", () => {
    const steps = [cond("c1", [step("a")])]
    const next = insertAt(
      steps,
      { kind: "branch", parentCid: "c1", branch: "no" },
      0,
      step("x"),
    )
    expect(next[0].branches?.yes.map((s) => s.cid)).toEqual(["a"])
    expect(next[0].branches?.no.map((s) => s.cid)).toEqual(["x"])
  })

  it("finds a condition nested inside another condition's branch", () => {
    const steps = [cond("outer", [cond("inner", [step("a")])])]
    const next = insertAt(
      steps,
      { kind: "branch", parentCid: "inner", branch: "yes" },
      1,
      step("x"),
    )
    const outerYes = next[0].branches?.yes ?? []
    expect(outerYes[0].branches?.yes.map((s) => s.cid)).toEqual(["a", "x"])
  })
})

describe("mapAtPath", () => {
  it("updates a root step", () => {
    const steps = [step("a"), step("b"), step("c")]
    const path = childPath([], { kind: "root" }, 1)
    const next = mapAtPath(steps, path, (s) => ({
      ...s,
      step_config: { text: "edited" },
    }))
    expect(next[0].cid).toBe("a")
    expect(next[1].step_config).toEqual({ text: "edited" })
    expect(next[1].cid).toBe("b")
    expect(next[2].cid).toBe("c")
  })

  it("updates a step inside a condition branch — the not-first child", () => {
    // Regression for issue #474: the old path model consumed an extra
    // branch marker and edited the FIRST child (or nothing) instead of
    // the requested child.
    const steps = [cond("c1", [step("first"), step("second")])]
    const condPath = childPath([], { kind: "root" }, 0)
    const secondPath = childPath(
      condPath,
      { kind: "branch", parentCid: "c1", branch: "yes" },
      1,
    )
    const next = mapAtPath(steps, secondPath, (s) => ({
      ...s,
      step_config: { text: "edited" },
    }))

    const yes = next[0].branches?.yes ?? []
    expect(yes[0].step_config).toEqual({}) // first child untouched
    expect(yes[0].cid).toBe("first")
    expect(yes[1].cid).toBe("second")
    expect(yes[1].step_config).toEqual({ text: "edited" })
  })

  it("updates a step inside a nested condition's branch", () => {
    const steps = [cond("outer", [cond("inner", [step("a"), step("b")])])]
    const outerCondPath = childPath([], { kind: "root" }, 0)
    const innerPath = childPath(
      outerCondPath,
      { kind: "branch", parentCid: "outer", branch: "yes" },
      0,
    )
    const bPath = childPath(
      innerPath,
      { kind: "branch", parentCid: "inner", branch: "yes" },
      1,
    )
    const next = mapAtPath(steps, bPath, (s) => ({
      ...s,
      step_config: { text: "edited" },
    }))

    const innerCond = next[0].branches?.yes?.[0]
    expect(innerCond?.branches?.yes[0].cid).toBe("a")
    expect(innerCond?.branches?.yes[0].step_config).toEqual({}) // untouched
    expect(innerCond?.branches?.yes[1].cid).toBe("b")
    expect(innerCond?.branches?.yes[1].step_config).toEqual({ text: "edited" })
  })
})

describe("removeAt", () => {
  it("removes a branch child at the addressed index", () => {
    const steps = [cond("c1", [step("a"), step("b"), step("c")])]
    const condPath = childPath([], { kind: "root" }, 0)
    const path = childPath(
      condPath,
      { kind: "branch", parentCid: "c1", branch: "yes" },
      1,
    )
    const next = removeAt(steps, path)
    expect(next[0].branches?.yes.map((s) => s.cid)).toEqual(["a", "c"])
  })
})

describe("moveAt", () => {
  it("swaps two branch children", () => {
    const steps = [cond("c1", [step("a"), step("b")])]
    const condPath = childPath([], { kind: "root" }, 0)
    const path = childPath(
      condPath,
      { kind: "branch", parentCid: "c1", branch: "yes" },
      0,
    )
    const next = moveAt(steps, path, 1)
    expect(next[0].branches?.yes.map((s) => s.cid)).toEqual(["b", "a"])
  })

  it("leaves the tree untouched when moving out of range", () => {
    const steps = [cond("c1", [step("a"), step("b")])]
    const condPath = childPath([], { kind: "root" }, 0)
    const path = childPath(
      condPath,
      { kind: "branch", parentCid: "c1", branch: "yes" },
      1,
    )
    const next = moveAt(steps, path, 1)
    expect(next[0].branches?.yes.map((s) => s.cid)).toEqual(["a", "b"])
  })

  it("leaves the tree untouched for a path that doesn't resolve", () => {
    const steps = [step("plain")] // no branches
    const badPath: StepPath = [
      { kind: "root", index: 0 },
      { kind: "branch", branch: "yes", index: 0 },
    ]
    expect(mapAtPath(steps, badPath, (s) => ({ ...s, step_type: "wait" }))[0].step_type).toBe(
      "send_message",
    )
    expect(removeAt(steps, badPath)).toEqual(steps)
  })
})