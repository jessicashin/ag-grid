
import {SvgFactory} from "../../svgFactory";
import {GridOptionsWrapper} from "../../gridOptionsWrapper";
import {SelectionRendererFactory} from "../../selectionRendererFactory";
import {ExpressionService} from "../../expressionService";
import {EventService} from "../../eventService";
import {Constants} from "../../constants";
import {Utils as _} from '../../utils';
import {Events} from "../../events";

var svgFactory = SvgFactory.getInstance();

export function groupCellRendererFactory(gridOptionsWrapper: GridOptionsWrapper,
                                selectionRendererFactory: SelectionRendererFactory,
                                expressionService: ExpressionService,
                                eventService: EventService) {

    return function groupCellRenderer(params: any) {

        var eGroupCell = document.createElement('span');
        var node = params.node;

        var cellExpandable = node.group && !node.footer;
        if (cellExpandable) {
            addExpandAndContract(eGroupCell, params);
        }

        var checkboxNeeded = params.checkbox && !node.footer;
        if (checkboxNeeded) {
            var eCheckbox = selectionRendererFactory.createSelectionCheckbox(node, params.rowIndex, params.addRenderedRowListener);
            eGroupCell.appendChild(eCheckbox);
        }

        if (params.innerRenderer) {
            createFromInnerRenderer(eGroupCell, params, params.innerRenderer);
        } else if (node.footer) {
            createFooterCell(eGroupCell, params);
        } else if (node.group) {
            createGroupCell(eGroupCell, params);
        } else {
            createLeafCell(eGroupCell, params);
        }

        // only do this if an indent - as this overwrites the padding that
        // the theme set, which will make things look 'not aligned' for the
        // first group level.
        var suppressPadding = params.suppressPadding;
        if (!suppressPadding && (node.footer || node.level > 0)) {
            var paddingFactor: any;
            if (params.colDef && params.padding >= 0) {
                paddingFactor = params.padding;
            } else {
                paddingFactor = 10;
            }
            var paddingPx = node.level * paddingFactor;
            if (node.footer) {
                paddingPx += 10;
            } else if (!node.group) {
                paddingPx += 5;
            }
            eGroupCell.style.paddingLeft = paddingPx + 'px';
        }

        return eGroupCell;
    };

    function addExpandAndContract(eGroupCell: any, params: any) {

        var eExpandIcon = createGroupExpandIcon(true);
        var eContractIcon = createGroupExpandIcon(false);
        eGroupCell.appendChild(eExpandIcon);
        eGroupCell.appendChild(eContractIcon);

        eExpandIcon.addEventListener('click', expandOrContract);
        eContractIcon.addEventListener('click', expandOrContract);
        eGroupCell.addEventListener('dblclick', expandOrContract);

        showAndHideExpandAndContract(eExpandIcon, eContractIcon, params.node.expanded);

        // if parent cell was passed, then we can listen for when focus is on the cell,
        // and then expand / contract as the user hits enter or space-bar
        if (params.eGridCell) {
            params.eGridCell.addEventListener('keydown', function(event: any) {
                if (_.isKeyPressed(event, Constants.KEY_ENTER)) {
                    expandOrContract();
                    event.preventDefault();
                }
            });
        }

        function expandOrContract() {
            expandGroup(eExpandIcon, eContractIcon, params);
        }
    }

    function showAndHideExpandAndContract(eExpandIcon: any, eContractIcon: any, expanded: any) {
        _.setVisible(eExpandIcon, !expanded);
        _.setVisible(eContractIcon, expanded);
    }

    function createFromInnerRenderer(eGroupCell: any, params: any, renderer: any) {
        _.useRenderer(eGroupCell, renderer, params);
    }

    function getRefreshFromIndex(params: any) {
        if (gridOptionsWrapper.isGroupIncludeFooter()) {
            return params.rowIndex;
        } else {
            return params.rowIndex + 1;
        }
    }

    function expandGroup(eExpandIcon: any, eContractIcon: any, params: any) {
        params.node.expanded = !params.node.expanded;
        var refreshIndex = getRefreshFromIndex(params);
        params.api.onGroupExpandedOrCollapsed(refreshIndex);
        showAndHideExpandAndContract(eExpandIcon, eContractIcon, params.node.expanded);

        var event: any = {node: params.node};
        eventService.dispatchEvent(Events.EVENT_ROW_GROUP_OPENED, event)
    }

    function createGroupExpandIcon(expanded: any) {
        var eIcon: any;
        if (expanded) {
            eIcon = _.createIcon('groupContracted', gridOptionsWrapper, null, svgFactory.createArrowRightSvg);
        } else {
            eIcon = _.createIcon('groupExpanded', gridOptionsWrapper, null, svgFactory.createArrowDownSvg);
        }
        _.addCssClass(eIcon, 'ag-group-expand');
        return eIcon;
    }

    // creates cell with 'Total {{key}}' for a group
    function createFooterCell(eGroupCell: any, params: any) {
        var footerValue: string;
        var groupName = getGroupName(params);
        if (params.footerValueGetter) {
            var footerValueGetter = params.footerValueGetter;
            // params is same as we were given, except we set the value as the item to display
            var paramsClone: any = _.cloneObject(params);
            paramsClone.value = groupName;
            if (typeof footerValueGetter === 'function') {
                footerValue = footerValueGetter(paramsClone);
            } else if (typeof footerValueGetter === 'string') {
                footerValue = expressionService.evaluate(footerValueGetter, paramsClone);
            } else {
                console.warn('ag-Grid: footerValueGetter should be either a function or a string (expression)');
            }
        } else {
            footerValue = 'Total ' + groupName;
        }

        var eText = document.createTextNode(footerValue);
        eGroupCell.appendChild(eText);
    }

    function getGroupName(params: any) {
        if (params.keyMap && typeof params.keyMap === 'object') {
            var valueFromMap = params.keyMap[params.node.key];
            if (valueFromMap) {
                return valueFromMap;
            } else {
                return params.node.key;
            }
        } else {
            return params.node.key;
        }
    }

    // creates cell with '{{key}} ({{childCount}})' for a group
    function createGroupCell(eGroupCell: any, params: any) {
        var groupName = getGroupName(params);

        // NOTE: this all needs to be revisited

        var colDefOfGroupedCol = params.api.getColumnDef(params.node.field);
        if (colDefOfGroupedCol && typeof colDefOfGroupedCol.cellRenderer === 'function') {
            params.value = groupName;
            _.useRenderer(eGroupCell, colDefOfGroupedCol.cellRenderer, params);
        } else {
            eGroupCell.appendChild(document.createTextNode(groupName));
        }

        // only include the child count if it's included, eg if user doing custom aggregation,
        // then this could be left out, or set to -1, ie no child count
        var suppressCount = params.suppressCount;
        if (!suppressCount && params.node.allChildrenCount >= 0) {
            eGroupCell.appendChild(document.createTextNode(" (" + params.node.allChildrenCount + ")"));
        }
    }

    // creates cell with '{{key}} ({{childCount}})' for a group
    function createLeafCell(eParent: any, params: any) {
        if (_.exists(params.value)) {
            var eText = document.createTextNode(' ' + params.value);
            eParent.appendChild(eText);
        }
    }
}