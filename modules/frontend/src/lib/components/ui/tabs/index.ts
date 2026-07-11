import Root from "$lib/components/ui/tabs/tabs.sv";
import Content from "$lib/components/ui/tabs/tabs-content.sv";
import List, {
	tabs_list_variants,
	type TabsListVariant,
} from "$lib/components/ui/tabs/tabs-list.sv";
import Trigger from "$lib/components/ui/tabs/tabs-trigger.sv";

export {
	Content,
	Content as TabsContent,
	List,
	List as TabsList,
	Root,
	Root as Tabs,
	tabs_list_variants,
	type TabsListVariant,
	Trigger,
	Trigger as TabsTrigger,
};
