import Root from "./pagination.svelte";
import Content from "./pagination-content.svelte";
import Item from "./pagination-item.svelte";
import Link from "./pagination-link.svelte";
import PrevButton from "./pagination-prev-button.svelte";
import NextButton from "./pagination-next-button.svelte";
import Ellipsis from "./pagination-ellipsis.svelte";
import Previous from "./pagination-previous.svelte";
import Next from "./pagination-next.svelte";

export {
	Content,
	Content as PaginationContent,
	Ellipsis,
	Ellipsis as PaginationEllipsis,
	Item,
	Item as PaginationItem,
	Link,
	Link as PaginationLink,
	Next,
	Next as PaginationNext,
	/** @deprecated Use `Next` instead. */
	NextButton,
	/** @deprecated Use `PaginationNext` instead. */
	NextButton as PaginationNextButton,
	/** @deprecated Use `Previous` instead. */
	PrevButton,
	/** @deprecated Use `PaginationPrevious` instead. */
	PrevButton as PaginationPrevButton,
	Previous,
	Previous as PaginationPrevious,
	Root,
	Root as Pagination,
};
