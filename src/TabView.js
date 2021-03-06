/* @flow */

import PropTypes from 'prop-types';
import * as React from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import PagerDefault from './PagerDefault';
import { NavigationStatePropType } from './PropTypes';
import TabBar from './TabBar';
import type {
  Scene,
  SceneRendererProps,
  NavigationState,
  Layout,
  PagerCommonProps,
  PagerExtraProps,
} from './TypeDefinitions';
import type
 { ViewStyleProp } from 'react-native/Libraries/StyleSheet/StyleSheet';

type Props<T> = PagerCommonProps<T> &
  PagerExtraProps & {
    onScrollViewRef: (ref) => void,
    onScroll: (e) => void,
    onRefresh?: (e) => void,
    refreshing?: boolean,
    navigationState: NavigationState<T>,
    onIndexChange: (index: number) => mixed,
    initialLayout?: Layout,
    isLoading?: boolean,
    renderLoaderComponent?: (props: *) => React.Node,
    isError?: boolean,
    renderErrorComponent?: (props: *) => React.Node,
    renderPager: (props: *) => React.Node,
    renderTopContent?: (props: *) => React.Node,
    renderScene: (props: SceneRendererProps<T> & Scene<T>) => React.Node,
    renderTabBar: (props: SceneRendererProps<T>) => React.Node,
    tabBarPosition: 'top' | 'bottom',
    useNativeDriver?: boolean,
    style?: ViewStyleProp,
  };

type State = {|
  layout: Layout & { measured: boolean },
  layoutXY: Animated.ValueXY,
  panX: Animated.Value,
  offsetX: Animated.Value,
  position: any,
  renderUnfocusedScenes: boolean,
|};

export default class TabView<T: *> extends React.Component<Props<T>, State> {
  static propTypes = {
    navigationState: NavigationStatePropType.isRequired,
    onIndexChange: PropTypes.func.isRequired,
    onEndReached: PropTypes.func,
    initialLayout: PropTypes.shape({
      height: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
    }),
    canJumpToTab: PropTypes.func.isRequired,
    renderPager: PropTypes.func.isRequired,
    renderScene: PropTypes.func.isRequired,
    renderTabBar: PropTypes.func,
    renderTopContent: PropTypes.func,
    isLoading: PropTypes.bool,
    renderLoaderComponent: PropTypes.func,
    isError: PropTypes.bool,
    renderErrorComponent: PropTypes.func,
    scrollEnabled: PropTypes.bool,
    tabBarPosition: PropTypes.oneOf(['top', 'bottom']),
  };

  static defaultProps = {
    canJumpToTab: () => true,
    tabBarPosition: 'top',
    renderTabBar: (props: *) => <TabBar {...props} />,
    renderPager: (props: *) => <PagerDefault {...props} />,
    getTestID: ({ route }: Scene<*>) =>
      typeof route.testID === 'string' ? route.testID : undefined,
    initialLayout: {
      height: 0,
      width: 0,
    },
    useNativeDriver: false,
  };

  constructor(props: Props<T>) {
    super(props);

    const { navigationState } = this.props;
    const layout = {
      ...this.props.initialLayout,
      measured: false,
    };

    const panX = new Animated.Value(0);
    const offsetX = new Animated.Value(-navigationState.index * layout.width);
    const layoutXY = new Animated.ValueXY({
      // This is hacky, but we need to make sure that the value is never 0
      x: layout.width || 0.001,
      y: layout.height || 0.001,
    });
    const position = Animated.multiply(
      Animated.divide(Animated.add(panX, offsetX), layoutXY.x),
      -1
    );

    this.state = {
      layout,
      layoutXY,
      panX,
      offsetX,
      position,
      renderUnfocusedScenes: false,
    };
  }

  componentDidMount() {
    this._mounted = true;

    // Delay rendering of unfocused scenes for improved startup
    setTimeout(() => this.setState({ renderUnfocusedScenes: true }), 0);
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _mounted: boolean = false;
  _nextIndex: ?number;

  _renderScene = (props: SceneRendererProps<T> & Scene<T>) => {
    return this.props.renderScene(props);
  };

  _handleLayout = (e: any) => {
    const { height, width } = e.nativeEvent.layout;

    if (
      this.state.layout.width === width &&
      this.state.layout.height === height
    ) {
      return;
    }

    this.state.offsetX.setValue(-this.props.navigationState.index * width);
    this.state.layoutXY.setValue({
      // This is hacky, but we need to make sure that the value is never 0
      x: width || 0.001,
      y: height || 0.001,
    });
    this.setState({
      layout: {
        measured: true,
        height,
        width,
      },
    });
  };

  _buildSceneRendererProps = (): SceneRendererProps<*> => ({
    panX: this.state.panX,
    offsetX: this.state.offsetX,
    position: this.state.position,
    layout: this.state.layout,
    navigationState: this.props.navigationState,
    jumpTo: this._jumpTo,
    useNativeDriver: this.props.useNativeDriver === true,
  });

  _jumpTo = (key: string) => {
    if (!this._mounted) {
      // We are no longer mounted, this is a no-op
      return;
    }

    const { canJumpToTab, navigationState } = this.props;
    const index = navigationState.routes.findIndex(route => route.key === key);

    if (!canJumpToTab(navigationState.routes[index])) {
      return;
    }

    if (index !== navigationState.index) {
      this.props.onIndexChange(index);
    }
  };

  render() {
    const {
      /* eslint-disable no-unused-vars */
      navigationState,
      onIndexChange,
      initialLayout,
      renderScene,
      /* eslint-enable no-unused-vars */
      renderPager,
      renderTopContent,
      renderLoaderComponent,
      renderErrorComponent,
      isLoading,
      isError,
      onEndReached,
      renderTabBar,
      tabBarPosition,
      onScrollViewRef,
      onScroll,
      onRefresh,
      refreshing,
      scrollEnabled,
      ...rest
    } = this.props;

    const props = this._buildSceneRendererProps();

    return renderTopContent ? (
      <ScrollView 
        ref={ref => {
          if (onScrollViewRef) {
            onScrollViewRef(ref)
          }
        }}
        scrollEnabled={scrollEnabled}
        stickyHeaderIndices={[1]} 
        collapsable={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={((isLoading && renderLoaderComponent) || (isError && renderErrorComponent)) && { flex: 1 }}
        onScroll={(e) => {
          if (onScroll) {
            onScroll(e);
          }

          let paddingToBottom = 10;
          paddingToBottom += e.nativeEvent.layoutMeasurement.height;
          if(e.nativeEvent.contentOffset.y >= e.nativeEvent.contentSize.height - paddingToBottom) {
            if (onEndReached) {
              onEndReached();
            }
          }
        }}
        scrollEventThrottle={400}>
          {renderTopContent(props)}
          {!isLoading && renderLoaderComponent && !isError && renderErrorComponent && tabBarPosition === 'top' && renderTabBar(props)}
          {isLoading && renderLoaderComponent 
            ? (
              <View style={{ flex: 1, alignItems: 'center' }}>
                {renderLoaderComponent()}
              </View>
            ) : isError && renderErrorComponent ? (
              <View style={{ flex: 1 }}>
                {renderErrorComponent()}
              </View>
            ) : (
              <View onLayout={this._handleLayout} style={styles.pager}>
                {renderPager({
                  ...props,
                  ...rest,
                  panX: this.state.panX,
                  offsetX: this.state.offsetX,
                  children: navigationState.routes.map(route => {
                    const scene = this._renderScene({
                      ...props,
                      route,
                    });

                    if (React.isValidElement(scene)) {
                      /* $FlowFixMe: https://github.com/facebook/flow/issues/4775 */
                      return React.cloneElement(scene, { key: route.key });
                    }

                    return scene;
                  }),
                })}
                </View>
              )}
        </ScrollView>
    ) : (
      <View collapsable={false} style={[styles.container, this.props.style]}>
        {tabBarPosition === 'top' && renderTabBar(props)}
        <View onLayout={this._handleLayout} style={styles.pager}>
          {renderPager({
            ...props,
            ...rest,
            panX: this.state.panX,
            offsetX: this.state.offsetX,
            children: navigationState.routes.map((route, index) => {
              const isFocused = this.props.navigationState.index === index;

              let scene;

              if (isFocused || this.state.renderUnfocusedScenes) {
                scene = this._renderScene({
                  ...props,
                  route,
                });
              } else {
                scene = <View />;
              }

              if (React.isValidElement(scene)) {
                /* $FlowFixMe: https://github.com/facebook/flow/issues/4775 */
                scene = React.cloneElement(scene, { key: route.key });
              }

              return scene;
            }),
          })}
        </View>
        {tabBarPosition === 'bottom' && renderTabBar(props)}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // overflow: 'hidden',
  },
  pager: {
    flex: 1
  },
});
