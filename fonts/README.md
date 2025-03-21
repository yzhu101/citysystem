# 自定义字体使用说明

要在游戏中使用自定义字体，请按照以下步骤操作：

1. 将你的字体文件（支持的格式：.woff2, .woff, .ttf, .otf）放在此 `fonts` 目录中
2. 在 HTML 文件的 style 标签中，使用 @font-face 规则声明你的字体：

```css
@font-face {
    font-family: '你的字体名称';
    src: url('fonts/你的字体文件名.woff2') format('woff2'),
         url('fonts/你的字体文件名.woff') format('woff'),
         url('fonts/你的字体文件名.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}
```

3. 然后在 CSS 中使用这个字体：

```css
body {
    font-family: '你的字体名称', sans-serif;
}
```

注意：
- 建议使用 .woff2 和 .woff 格式的字体文件，它们具有更好的压缩率和浏览器兼容性
- 确保你有权使用该字体，并遵守相关的许可协议
- 考虑使用 font-display 属性来控制字体加载行为