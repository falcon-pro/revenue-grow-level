<!-- src/lib/components/UI/Skeleton.svelte -->
<script lang="ts">
  export let width: string = '100%';
  export let height: string = '1rem'; // Default height (e.g., for a line of text)
  export let className: string = ''; // Allow additional classes
  export let type: 'text' | 'avatar' | 'block' = 'text';

  let generatedHeight = height;
  if (type === 'text' && height === '1rem')  generatedHeight = '0.75rem'; // smaller for text lines
  if (type === 'avatar') generatedHeight = width; // square avatar

</script>

<div
  class="bg-gray-300 animate-pulse {type === 'avatar' ? 'rounded-full' : 'rounded-md'} {className}"
  style="width: {width}; height: {generatedHeight};"
  aria-hidden="true"
></div>