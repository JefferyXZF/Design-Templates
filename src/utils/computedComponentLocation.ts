/* eslint-disable no-undef */
// 计算组件位置函数，提供给editBox调用，拖动点会改变width、height、left、top
import { flatten } from 'lodash-es'
import {
  ComputedPoint,
  ComputedPosition,
  MatrixComputedPosition,
  OldPosition
} from '@/types/location'

/**
 * 获取两点的中心点坐标
 * @param p1
 * @param p2
 * @returns ComputedPoint
 */
function getCenterPoint(p1: ComputedPoint, p2: ComputedPoint) {
  return {
    x: p1.x + (p2.x - p1.x) / 2,
    y: p1.y + (p2.y - p1.y) / 2
  }
}

/**
 *坐标旋转映射点
 * @param curPoint 当前点
 * @param center 中心点
 * @param rotate 旋转角度
 * http://t.zoukankan.com/wxl845235800-p-9600606.html
 * 假设对图片上任意点(x,y)，绕一个坐标点(rx0,ry0)逆时针旋转a角度后的新的坐标设为(x0, y0)，有公式：
 * x0= (x - rx0)*cos(a) - (y - ry0)*sin(a) + rx0 ;
 * y0= (x - rx0)*sin(a) + (y - ry0)*cos(a) + ry0 ;
 */
function CoordinateRotateMappingPoint(point: ComputedPoint, center: ComputedPoint, rotate: number) {
  return {
    x:
      (point.x - center.x) * Math.cos(rotate * (Math.PI / 180)) -
      (point.y - center.y) * Math.sin(rotate * (Math.PI / 180)) +
      center.x,
    y:
      (point.x - center.x) * Math.sin(rotate * (Math.PI / 180)) +
      (point.y - center.y) * Math.cos(rotate * (Math.PI / 180)) +
      center.y
  }
}

/**
 * 计算转角的点拖动的前后位置
 * @param curPoint 当前位置坐标
 * @param symmetriPoint 对称点坐标
 * @param rotate 旋转的角度
 * @returns 计算出来的位置
 */
function computedCornerPoint(
  curPoint: ComputedPoint,
  symmetriPoint: ComputedPoint,
  rotate: number
): ComputedPosition {
  const newCenter = getCenterPoint(curPoint, symmetriPoint)
  //   当前点
  const point = CoordinateRotateMappingPoint(curPoint, newCenter, rotate)
  //   对称点
  const symmetry = CoordinateRotateMappingPoint(symmetriPoint, newCenter, rotate)
  return {
    width: Math.abs(Math.round(symmetry.x - point.x)),
    height: Math.abs(Math.round(symmetry.y - point.y)),
    left: Math.round(Math.min(point.x, symmetry.x)),
    top: Math.round(Math.min(point.y, symmetry.y))
  }
}

function computedTopBottom(
  curPoint: ComputedPoint,
  symmetriPoint: ComputedPoint,
  rotate: number,
  oldPosition: ComputedPoint,
  oldRect: OldPosition
) {
  //   当前点
  const point = CoordinateRotateMappingPoint(curPoint, oldPosition, rotate)

  // 移动后的top或者bottom的中间点
  const middleTopOrBottom = CoordinateRotateMappingPoint(
    {
      x: oldPosition.x,
      y: point.y
    },
    curPoint,
    rotate
  )

  const newHeight = Math.sqrt(
    Math.abs(middleTopOrBottom.x - symmetriPoint.x) ** 2 +
      Math.abs(middleTopOrBottom.y - symmetriPoint.y) ** 2
  )

  const newCenter = getCenterPoint(middleTopOrBottom, symmetriPoint)

  console.log('newHeight===', newHeight)

  console.log('LeftTop', {
    x: newCenter.x - oldRect.width / 2,
    y: newCenter.y - newHeight / 2
  })
  // 旋转前的topLeft点 -> 计算旋转后的点
  const leftTop = CoordinateRotateMappingPoint(
    {
      x: newCenter.x - oldRect.width / 2,
      y: newCenter.y - newHeight / 2
    },
    newCenter,
    rotate
  )
  //   已知两个点坐标和夹角和三条边长度求坐标
  return {
    width: oldRect.width,
    height: Math.round(newHeight),
    left: Math.round(leftTop.x),
    top: Math.round(leftTop.y)
  }
}

// deg 转 角度
function degToAngle(rotate: number) {
  return rotate * (Math.PI / 180)
}

// 两个矩阵相乘，返回新的矩阵
function matrixMul(a: number[][], b: number[][]) {
  // 相乘约束
  if (a[0].length !== b.length) {
    throw new Error('矩阵异常，不能计算')
  }
  const m = a.length
  const p = a[0].length
  const n = b[0].length

  // 初始化 m*n 全 0 二维数组
  const c = new Array(m).fill(0).map(() => new Array(n).fill(0))

  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < p; k += 1) {
        c[i][j] += a[i][k] * b[k][j]
      }
    }
  }

  return c
}
// 根据位移和旋转计算matrix属性
const computedMatrix = (x: number, y: number, rotate: number = 0) => {
  // 位移矩阵
  const a = [
    [1, 0],
    [0, 1],
    [x, y]
  ]
  //   const a = [
  //     [1, 0, x],
  //     [0, 1, y]
  //   ]
  const sinAngle = Math.sin(degToAngle(rotate))
  const cosAngle = Math.cos(degToAngle(rotate))
  //   旋转矩阵
  const b = [
    [cosAngle, sinAngle],
    [-sinAngle, cosAngle]
  ]
  //   const b = [
  //     [cosAngle, sinAngle, 0],
  //     [-sinAngle, cosAngle, 0]
  //   ]
  return matrixMul(a, b)
}

// 坐标点和计算函数的对应关系
const pointFunc = {
  lt: computedCornerPoint,
  rt: computedCornerPoint,
  rb: computedCornerPoint,
  lb: computedCornerPoint,
  t: computedTopBottom,
  b: computedTopBottom
}

export default function computedLocation(
  pointName: string,
  curPoint: ComputedPoint,
  symmetriPoint: ComputedPoint,
  rotate: number | undefined,
  oldPosition: ComputedPoint,
  oldRect: OldPosition
): MatrixComputedPosition {
  const p: MatrixComputedPosition = pointFunc[pointName](
    curPoint,
    symmetriPoint,
    rotate || 0,
    oldPosition,
    oldRect
  )
  p.matrix = flatten(computedMatrix(p.left, p.top, rotate))
  return p
}
