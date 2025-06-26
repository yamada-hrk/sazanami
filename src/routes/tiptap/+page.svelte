<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';

	let element;
	let editor;

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [StarterKit],
			content: '<p>Hello World! 🌍️ </p>',
			onTransaction: () => {
				// force re-render so `editor.isActive` works as expected
				editor = editor;
			},
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
</script>

<div class="m-20 border-b">

    
    {#if editor}
	<button
    on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
    class:active={editor.isActive('heading', { level: 1 })}
	>
    H1
</button>
<button
on:click={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
class:active={editor.isActive('heading', { level: 2 })}
>
H2
</button>
<button
on:click={() => editor.chain().focus().setParagraph().run()}
class:active={editor.isActive('paragraph')}
>
P
</button>
{/if}
</div>

<div bind:this={element} class="card bg-base-200 h-100 m-30 p-10 " />

<style>
    button.active {
        background: black;
		color: white;
	}
    h1{
        font-size: large;
    }
</style>