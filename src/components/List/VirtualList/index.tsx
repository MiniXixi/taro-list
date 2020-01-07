import Taro, { PureComponent } from '@tarojs/taro';
import PropTypes from 'prop-types';
import { View } from '@tarojs/components';

import {
  DIRECTION,
  ALIGN,
  sizeProp,
  DEFAULT_ZINDEX,
  positionProp
} from './types';
import SizeAndPositionManager from './SizeAndPositionManger';
import {
  getItemSizeGetter,
  getEstimatedGetter,
  normalizeStyle,
  normalizeValue
} from './utils';
import {
  VirutalListDataManager,
  VirutalListItemData,
  VirutalListDataManagerState
} from './VirutalListDataManager';

const STYLE_INNER: React.CSSProperties = {
  position: 'relative'
};

const STYLE_ITEM: {
  position: ItemStylePosition;
  width: number | string;
  height: number | string;
  left: number;
  top: number;
} = {
  position: 'absolute',
  width: '100%',
  height: 'auto',
  left: 0,
  top: 0
};

export interface VirtualListProps {
  width: number | string;
  height: number | string;
  dynamic?: boolean;
  align?: ALIGN;
  scrollDirection?: DIRECTION;
  scrollToIndex?: number;
  dataManager: VirutalListDataManager;
}

type ItemStylePosition = 'sticky' | 'absolute';

export interface ItemStyle {
  position: ItemStylePosition;
  width: string | number;
  height: string | number;
  left: number;
  top: number;
  zIndex: React.CSSProperties['zIndex'];
}

export class VirtualList extends PureComponent<VirtualListProps> {
  static defaultProps: Partial<VirtualListProps> = {
    scrollDirection: DIRECTION.VERTICAL,
    align: ALIGN.Auto,
    dynamic: false
  };

  static propTypes: React.WeakValidationMap<VirtualListProps> = {
    dataManager: PropTypes.instanceOf(VirutalListDataManager).isRequired
  };

  private delayUpdateTimer: number | null = null;
  private styleCache: Record<number, ItemStyle> = {};
  private sizeAndPositionManager: SizeAndPositionManager;
  private needUpdate = true;
  private offset: number = 0;

  componentDidMount() {
    const { dataManager } = this.props;
    const { estimatedSize, itemCount, itemSize } = dataManager.__getState();

    const estimatedSizeGetter = getEstimatedGetter(estimatedSize!, itemSize!);
    this.sizeAndPositionManager = new SizeAndPositionManager({
      itemCount: itemCount!,
      itemSizeGetter: getItemSizeGetter(itemSize!),
      estimatedSizeGetter
    });

    dataManager.__setUpdater(this.update);
    dataManager.__setOnStateChange(this.onStateChange);
  }

  componentDidUpdate() {
    this.updateVirutalListDataRange();
  }

  componentWillUnmount() {
    if (this.delayUpdateTimer !== null) {
      clearTimeout(this.delayUpdateTimer);
    }

    this.props.dataManager.destroy();
  }

  updateVirutalListDataRange = () => {
    if (!this.needUpdate) {
      return;
    }

    this.props.dataManager.__nextTickUpdate();
    this.needUpdate = false;
  };

  setScrollOffset = (scrollOffset: number) => {
    if (this.offset !== scrollOffset) {
      this.offset = scrollOffset;
      this.needUpdate = true;
      this.updateVirutalListDataRange();
    }
  };

  private onStateChange = (prevState: VirutalListDataManagerState<any>) => {
    const {
      itemSize,
      itemCount,
      estimatedSize
    } = this.props.dataManager.__getState();

    if (prevState.itemCount !== itemCount) {
      this.sizeAndPositionManager.updateConfig({
        itemCount
      });
    }

    if (
      prevState.itemSize !== itemSize ||
      prevState.estimatedSize !== estimatedSize
    ) {
      this.sizeAndPositionManager.updateConfig({
        estimatedSizeGetter: getEstimatedGetter(estimatedSize, itemSize),
        itemSizeGetter: getItemSizeGetter(itemSize)
      });
    }

    this.recomputeSizes();
    this.forceUpdate();
  };

  private update = (data: any[]) => {
    const items: VirutalListItemData[] = [];
    const { overscan, stickyIndices } = this.props.dataManager.__getState();

    const { start, end } = this.sizeAndPositionManager.getVisibleRange({
      containerSize: this.getContainerSize(),
      currentOffset: this.offset,
      overscan: overscan!
    });

    if (start !== undefined && end !== undefined) {
      if (Array.isArray(stickyIndices)) {
        stickyIndices.forEach(i =>
          items.push({
            index: i,
            style: this.getStyle(i, true),
            item: data[i]
          })
        );
      }

      for (let i = start; i <= end; i++) {
        if (Array.isArray(stickyIndices) && stickyIndices.includes(i)) {
          continue;
        }
        items.push({
          index: i,
          style: this.getStyle(i),
          item: data[i]
        });
      }
    }

    return items;
  };

  render() {
    const { width, height, scrollDirection } = this.props;

    const totalSize = this.sizeAndPositionManager
      ? this.sizeAndPositionManager.getTotalSize()
      : 0;
    const outterStyle = normalizeStyle({
      width,
      height
    });

    const innerStyle = {
      ...STYLE_INNER,
      [sizeProp[scrollDirection!]]: normalizeValue(totalSize)
    };

    return (
      <View style={outterStyle}>
        <View style={innerStyle}>{this.props.children}</View>
      </View>
    );
  }

  private recomputeSizes = (index: number = 0) => {
    this.styleCache = {};
    this.sizeAndPositionManager.resetItem(index);
  };

  private getContainerSize(props = this.props) {
    const { scrollDirection } = props;
    return props[sizeProp[scrollDirection!]];
  }

  private getStyle(index: number, sticky?: boolean,) {
    const { scrollDirection } = this.props;
    const style = this.styleCache[index];

    if (style) {
      return style;
    }

    const sizeAndPosition = this.sizeAndPositionManager.getSizeAndPositionForIndex(
      index
    );
    const size = sizeAndPosition.size;
    const itemStyle: ItemStyle = sticky
      ? {
          ...STYLE_ITEM,
          [positionProp[scrollDirection!]]: 0,
          [sizeProp[scrollDirection!]]: size,
          zIndex: DEFAULT_ZINDEX,
          position: 'sticky'
        }
      : {
          ...STYLE_ITEM,
          [positionProp[scrollDirection!]]: sizeAndPosition.offset,
          [sizeProp[scrollDirection!]]: size,
          zIndex: 'auto'
        };

    // @ts-ignore
    this.styleCache[index] = normalizeStyle(itemStyle);

    return this.styleCache[index];
  }
}

export default VirtualList;