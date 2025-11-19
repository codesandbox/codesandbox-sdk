import { describe, it, expect, vi } from 'vitest'
import { EmitterSubscription } from '../src/utils/event'
import { Disposable } from '../src/utils/disposable'

describe('EmitterSubscription', () => {
  it('should create subscription when first listener is added', () => {
    const createSubscription = vi.fn(() => Disposable.create(() => {}))
    const subscription = new EmitterSubscription<number>(createSubscription)

    expect(createSubscription).not.toHaveBeenCalled()

    const disposable = subscription.event(() => {})

    expect(createSubscription).toHaveBeenCalledTimes(1)

    disposable.dispose()
  })

  it('should not create multiple subscriptions for multiple listeners', () => {
    const createSubscription = vi.fn(() => Disposable.create(() => {}))
    const subscription = new EmitterSubscription<number>(createSubscription)

    const disposable1 = subscription.event(() => {})
    const disposable2 = subscription.event(() => {})
    const disposable3 = subscription.event(() => {})

    expect(createSubscription).toHaveBeenCalledTimes(1)

    disposable1.dispose()
    disposable2.dispose()
    disposable3.dispose()
  })

  it('should fire events to all listeners', () => {
    const subscription = new EmitterSubscription<number>((fire) => {
      fire(42)
      return Disposable.create(() => {})
    })

    const listener1 = vi.fn()
    const listener2 = vi.fn()
    const listener3 = vi.fn()

    subscription.event(listener1)
    subscription.event(listener2)
    subscription.event(listener3)

    expect(listener1).toHaveBeenCalledWith(42)
    expect(listener2).toHaveBeenCalledWith(42)
    expect(listener3).toHaveBeenCalledWith(42)
  })

  it('should allow firing events from subscription callback', () => {
    let fireFn: ((value: number) => void) | undefined

    const subscription = new EmitterSubscription<number>((fire) => {
      fireFn = fire
      return Disposable.create(() => {})
    })

    const listener = vi.fn()
    subscription.event(listener)

    expect(fireFn).toBeDefined()

    fireFn!(100)
    fireFn!(200)
    fireFn!(300)

    expect(listener).toHaveBeenCalledTimes(3)
    expect(listener).toHaveBeenNthCalledWith(1, 100)
    expect(listener).toHaveBeenNthCalledWith(2, 200)
    expect(listener).toHaveBeenNthCalledWith(3, 300)
  })

  it('should dispose subscription when last listener is removed', () => {
    const dispose = vi.fn()
    const createSubscription = vi.fn(() => Disposable.create(dispose))
    const subscription = new EmitterSubscription<number>(createSubscription)

    const disposable1 = subscription.event(() => {})
    const disposable2 = subscription.event(() => {})

    expect(dispose).not.toHaveBeenCalled()

    disposable1.dispose()
    expect(dispose).not.toHaveBeenCalled()

    disposable2.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('should recreate subscription if listener is added again after all removed', () => {
    const dispose = vi.fn()
    const createSubscription = vi.fn(() => Disposable.create(dispose))
    const subscription = new EmitterSubscription<number>(createSubscription)

    const disposable1 = subscription.event(() => {})
    disposable1.dispose()

    expect(createSubscription).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)

    const disposable2 = subscription.event(() => {})

    expect(createSubscription).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledTimes(1)

    disposable2.dispose()
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('should stop firing to disposed listeners', () => {
    let fireFn: ((value: number) => void) | undefined

    const subscription = new EmitterSubscription<number>((fire) => {
      fireFn = fire
      return Disposable.create(() => {})
    })

    const listener1 = vi.fn()
    const listener2 = vi.fn()
    const listener3 = vi.fn()

    const disposable1 = subscription.event(listener1)
    subscription.event(listener2)
    subscription.event(listener3)

    fireFn!(1)
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(1)
    expect(listener3).toHaveBeenCalledTimes(1)

    disposable1.dispose()

    fireFn!(2)
    expect(listener1).toHaveBeenCalledTimes(1) // Not called again
    expect(listener2).toHaveBeenCalledTimes(2)
    expect(listener3).toHaveBeenCalledTimes(2)
  })

  it('should cleanup everything on dispose', () => {
    const subscriptionDispose = vi.fn()
    const createSubscription = vi.fn(() => Disposable.create(subscriptionDispose))

    let fireFn: ((value: number) => void) | undefined
    const subscription = new EmitterSubscription<number>((fire) => {
      fireFn = fire
      return Disposable.create(subscriptionDispose)
    })

    const listener = vi.fn()
    subscription.event(listener)

    subscription.dispose()

    expect(subscriptionDispose).toHaveBeenCalledTimes(1)

    // Should not fire to listeners after dispose
    fireFn!(42)
    expect(listener).not.toHaveBeenCalled()
  })

  it('should work with interval example', () => {
    vi.useFakeTimers()

    let intervalId: NodeJS.Timeout
    const subscription = new EmitterSubscription<number>((fire) => {
      intervalId = setInterval(() => fire(Date.now()), 1000)
      return Disposable.create(() => clearInterval(intervalId))
    })

    const listener = vi.fn()
    const disposable = subscription.event(listener)

    vi.advanceTimersByTime(3500)
    expect(listener).toHaveBeenCalledTimes(3)

    disposable.dispose()

    // Should not receive more events after dispose
    vi.advanceTimersByTime(5000)
    expect(listener).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  it('should handle multiple add/remove cycles correctly', () => {
    const dispose = vi.fn()
    const createSubscription = vi.fn(() => Disposable.create(dispose))
    const subscription = new EmitterSubscription<number>(createSubscription)

    // Cycle 1
    const d1 = subscription.event(() => {})
    d1.dispose()
    expect(createSubscription).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)

    // Cycle 2
    const d2 = subscription.event(() => {})
    d2.dispose()
    expect(createSubscription).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledTimes(2)

    // Cycle 3
    const d3 = subscription.event(() => {})
    d3.dispose()
    expect(createSubscription).toHaveBeenCalledTimes(3)
    expect(dispose).toHaveBeenCalledTimes(3)
  })
})