import Root from "./pagination.sv";
import Content from "./pagination-content.sv";
import Item from "./pagination-item.sv";
import Link from "./pagination-link.sv";
import PrevButton from "./pagination-prev-button.sv";
import NextButton from "./pagination-next-button.sv";
import Ellipsis from "./pagination-ellipsis.sv";
import Previous from "./pagination-previous.sv";
import Next from "./pagination-next.sv";

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
