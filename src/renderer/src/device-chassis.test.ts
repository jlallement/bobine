import { describe, expect, it } from 'vitest'
import { deviceChassis } from './device-chassis'

const T = 'com.apple.CoreSimulator.SimDeviceType.'

describe('deviceChassis', () => {
  it('gives recent iPhones rounded corners and a thin, even bezel', () => {
    expect(deviceChassis(`${T}iPhone-Air`, { width: 402 })).toEqual({
      radius: 59,
      side: 11,
      top: 11,
      homeButton: false
    })
    expect(deviceChassis(`${T}iPhone-17-Pro-Max`, { width: 440 }).radius).toBe(65)
  })

  it('gives home-button iPhones a square screen and a chin', () => {
    expect(deviceChassis(`${T}iPhone-SE-3rd-generation`, { width: 375 })).toEqual({
      radius: 0,
      side: 16,
      top: 72,
      homeButton: true
    })
  })

  it('tells iPads apart', () => {
    expect(deviceChassis(`${T}iPad-Pro-11-inch-M4-8GB`, { width: 834 })).toMatchObject({
      radius: 18,
      homeButton: false
    })
    expect(deviceChassis(`${T}iPad-9th-generation`, { width: 810 })).toMatchObject({
      radius: 0,
      homeButton: true
    })
  })

  it('falls back to a recent iPhone when the type is unknown', () => {
    expect(deviceChassis(undefined, { width: 390 })).toMatchObject({
      radius: 58,
      homeButton: false
    })
  })
})
