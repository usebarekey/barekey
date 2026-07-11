import Root from "$lib/components/ui/pagination/pagination.sv";
import Content from "$lib/components/ui/pagination/pagination-content.sv";
import Item from "$lib/components/ui/pagination/pagination-item.sv";
import Link from "$lib/components/ui/pagination/pagination-link.sv";
import PrevButton from "$lib/components/ui/pagination/pagination-prev-button.sv";
import NextButton from "$lib/components/ui/pagination/pagination-next-button.sv";
import Ellipsis from "$lib/components/ui/pagination/pagination-ellipsis.sv";
import Previous from "$lib/components/ui/pagination/pagination-previous.sv";
import Next from "$lib/components/ui/pagination/pagination-next.sv";

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
